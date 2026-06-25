import * as store from "@/lib/store";
import type { Bot, CustomTool } from "@/lib/types";
import type { ToolDef } from "./types";

export * from "./types";

/** Runtime context handed to a tool's execute() — gives it scoped store access. */
export interface ToolContext {
  bot: Bot;
  conversationId?: string;
}

interface ToolImpl {
  def: ToolDef;
  execute(args: Record<string, unknown>, ctx: ToolContext): Promise<string> | string;
}

function str(v: unknown, fallback = ""): string {
  return v === undefined || v === null ? fallback : String(v).trim();
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

// --- Demo product catalog (stand-in for a real merchant catalog API) --------
const CATALOG = [
  { name: "iPhone 15", price: 699, stock: true },
  { name: "Samsung Galaxy S24", price: 649, stock: true },
  { name: "AirPods Pro", price: 199, stock: false },
  { name: "MacBook Air M3", price: 1099, stock: true },
  { name: "Anker 65W Charger", price: 29, stock: true },
];

const ORDER_STATUSES = [
  "Processing",
  "Shipped",
  "Out for delivery",
  "Delivered",
  "Delayed",
];

// ---------------------------------------------------------------------------
// Built-in tool registry. In production these would hit real merchant / CRM /
// logistics APIs; here they are deterministic stand-ins so the agentic loop is
// fully demoable.
// ---------------------------------------------------------------------------
const BUILTINS: Record<string, ToolImpl> = {
  lookup_order: {
    def: {
      name: "lookup_order",
      description:
        "Look up the current status of a customer order by its order ID.",
      parameters: {
        type: "object",
        properties: {
          order_id: {
            type: "string",
            description: "The order identifier, e.g. ORD-1234.",
          },
        },
        required: ["order_id"],
      },
      triggers: [
        "order",
        "tracking",
        "track",
        "status",
        "طلب",
        "طلبية",
        "شحنة",
        "تتبع",
        "أوردر",
        "وين",
      ],
    },
    execute(args) {
      const id = str(args.order_id, "UNKNOWN").toUpperCase();
      const h = hash(id);
      const status = ORDER_STATUSES[h % ORDER_STATUSES.length];
      const eta = (h % 5) + 1;
      return `Order ${id}: status=${status}; carrier=Aramex; eta=${eta} day(s).`;
    },
  },

  product_lookup: {
    def: {
      name: "product_lookup",
      description:
        "Search the product catalog for a product's price and availability.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Product name or keyword to search for.",
          },
        },
        required: ["query"],
      },
      triggers: [
        "price",
        "product",
        "available",
        "stock",
        "سعر",
        "بكم",
        "بكام",
        "منتج",
        "متوفر",
        "مخزون",
      ],
    },
    execute(args) {
      const q = str(args.query).toLowerCase();
      const match =
        CATALOG.find((p) => p.name.toLowerCase().includes(q)) ||
        CATALOG.find(
          (p) => q && p.name.toLowerCase().split(" ").some((w) => q.includes(w)),
        );
      if (!match) return `No catalog product matched "${str(args.query)}".`;
      return `${match.name}: price=${match.price} JOD; ${match.stock ? "in stock" : "out of stock"}.`;
    },
  },

  create_ticket: {
    def: {
      name: "create_ticket",
      description:
        "Create a support ticket for an issue that needs human follow-up.",
      parameters: {
        type: "object",
        properties: {
          summary: {
            type: "string",
            description: "A short summary of the customer's issue.",
          },
        },
        required: ["summary"],
      },
      triggers: [
        "complaint",
        "ticket",
        "refund",
        "broken",
        "شكوى",
        "مشكلة",
        "بلاغ",
        "عطل",
        "تذكرة",
        "استرجاع",
        "خربان",
      ],
    },
    execute(args, ctx) {
      const summary = str(args.summary, "Customer issue");
      const ticket = store.createTicket({
        tenantId: ctx.bot.tenantId,
        botId: ctx.bot.id,
        conversationId: ctx.conversationId,
        summary,
      });
      return `Ticket ${ticket.id} created for: "${summary}". The team will follow up.`;
    },
  },

  escalate_to_human: {
    def: {
      name: "escalate_to_human",
      description:
        "Hand the conversation over to a human agent when the user explicitly asks for a human, is frustrated, or the issue cannot be resolved automatically.",
      parameters: {
        type: "object",
        properties: {
          reason: {
            type: "string",
            description: "Why the conversation needs a human agent.",
          },
        },
        required: [],
      },
      triggers: [
        "human",
        "agent",
        "representative",
        "person",
        "موظف",
        "بشري",
        "ممثل",
        "شخص",
        "خدمة العملاء",
      ],
    },
    execute(_args, ctx) {
      if (ctx.conversationId) {
        store.updateConversation(ctx.conversationId, { status: "handoff" });
      }
      return "Escalated to a human agent. A team member will join this conversation shortly.";
    },
  },
};

// --- Custom (user-defined HTTP) tools --------------------------------------

function customToolToDef(ct: CustomTool): ToolDef {
  const properties: ToolDef["parameters"]["properties"] = {};
  for (const p of ct.params) {
    properties[p.name] = { type: "string", description: p.description };
  }
  return {
    name: ct.name,
    description: ct.description,
    parameters: {
      type: "object",
      properties,
      required: ct.params.map((p) => p.name),
    },
    // Let the mock provider trigger custom tools by their name tokens for demos.
    triggers: ct.name.split(/[_\-\s]+/).filter(Boolean).map((t) => t.toLowerCase()),
  };
}

function fillTemplate(
  tpl: string,
  values: Record<string, string>,
  encode: boolean,
): string {
  return tpl.replace(/\{(\w+)\}/g, (_m, k: string) => {
    const v = values[k] ?? "";
    return encode ? encodeURIComponent(v) : v;
  });
}

/** Basic SSRF guard: block loopback / private / link-local (metadata) hosts. */
function isBlockedHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === "localhost" || h === "0.0.0.0" || h === "::1" || h.endsWith(".local"))
    return true;
  const m = h.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    if (a === 127 || a === 10 || a === 0) return true;
    if (a === 192 && b === 168) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 169 && b === 254) return true;
  }
  return false;
}

async function executeCustomTool(
  ct: CustomTool,
  args: Record<string, unknown>,
): Promise<string> {
  const values: Record<string, string> = {};
  for (const p of ct.params) values[p.name] = str(args[p.name]);

  const url = fillTemplate(ct.url, values, true);
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return `Invalid URL produced for tool "${ct.name}".`;
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return "Blocked: only http(s) URLs are allowed.";
  }
  if (isBlockedHost(parsed.hostname)) {
    return "Blocked: target host is not allowed.";
  }

  const headers: Record<string, string> = {};
  for (const [k, v] of Object.entries(ct.headers ?? {})) {
    headers[k] = fillTemplate(v, values, false);
  }

  const init: RequestInit = { method: ct.method, headers };
  if (ct.method === "POST") {
    init.body = ct.bodyTemplate
      ? fillTemplate(ct.bodyTemplate, values, false)
      : JSON.stringify(values);
    if (!headers["content-type"] && !headers["Content-Type"]) {
      headers["content-type"] = "application/json";
    }
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    const text = (await res.text()).slice(0, 600);
    return `HTTP ${res.status}: ${text}`;
  } catch (err) {
    return `Request failed: ${err instanceof Error ? err.message : "error"}`;
  } finally {
    clearTimeout(timer);
  }
}

// --- Public API ------------------------------------------------------------

/** All available tool names: built-ins plus a tenant's custom tools. */
export function toolNames(tenantId?: string): string[] {
  const custom = tenantId ? store.listCustomTools(tenantId).map((t) => t.name) : [];
  return [...Object.keys(BUILTINS), ...custom];
}

/** Resolve enabled tool names to their definitions (built-in + custom). */
export function getToolDefs(names: string[], tenantId?: string): ToolDef[] {
  const customByName = new Map(
    (tenantId ? store.listCustomTools(tenantId) : []).map((t) => [t.name, t]),
  );
  const defs: ToolDef[] = [];
  for (const name of names) {
    if (BUILTINS[name]) defs.push(BUILTINS[name].def);
    else {
      const ct = customByName.get(name);
      if (ct) defs.push(customToolToDef(ct));
    }
  }
  return defs;
}

export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  ctx: ToolContext,
): Promise<string> {
  const builtin = BUILTINS[name];
  if (builtin) {
    try {
      return await builtin.execute(args, ctx);
    } catch (err) {
      return `Tool "${name}" failed: ${err instanceof Error ? err.message : "error"}`;
    }
  }
  const ct = store
    .listCustomTools(ctx.bot.tenantId)
    .find((t) => t.name === name);
  if (ct) return executeCustomTool(ct, args);
  return `Unknown tool: ${name}`;
}
