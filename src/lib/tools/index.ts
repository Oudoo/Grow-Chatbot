import * as store from "@/lib/store";
import type { Bot, CustomTool } from "@/lib/types";
import {
  integrationToolNames,
  resolveIntegrationTool,
} from "@/lib/integrations";
import { mcpListTools, mcpCallTool } from "@/lib/mcp/client";
import type { ToolDef } from "./types";

export * from "./types";

/** Runtime context handed to a tool's execute() — gives it scoped store access. */
export interface ToolContext {
  bot: Bot;
  conversationId?: string;
}

type ToolRunner = (
  args: Record<string, unknown>,
  ctx: ToolContext,
) => Promise<string> | string;

/** A per-turn set of resolved tools with a single executor. */
export interface Toolset {
  defs: ToolDef[];
  execute(
    name: string,
    args: Record<string, unknown>,
    ctx: ToolContext,
  ): Promise<string>;
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

/**
 * All tool names selectable per bot: built-ins + a tenant's custom HTTP tools +
 * tools from connected integrations. (MCP tools are enabled per server, not by
 * name, so they are not listed here.)
 */
export function toolNames(tenantId?: string): string[] {
  if (!tenantId) return Object.keys(BUILTINS);
  return [
    ...Object.keys(BUILTINS),
    ...store.listCustomTools(tenantId).map((t) => t.name),
    ...integrationToolNames(tenantId),
  ];
}

/**
 * Build the per-turn toolset for a bot, aggregating every tool source —
 * built-ins, custom HTTP tools, integration tools, and (async) MCP servers —
 * behind a single executor.
 */
export async function buildToolset(bot: Bot): Promise<Toolset> {
  const tenantId = bot.tenantId;
  const enabled = bot.tools ?? [];
  const defs: ToolDef[] = [];
  const runners = new Map<string, ToolRunner>();

  // Built-in tools
  for (const name of enabled) {
    const b = BUILTINS[name];
    if (b) {
      defs.push(b.def);
      runners.set(name, b.execute);
    }
  }

  // Custom HTTP tools
  const customs = store.listCustomTools(tenantId);
  for (const ct of customs) {
    if (!enabled.includes(ct.name)) continue;
    defs.push(customToolToDef(ct));
    runners.set(ct.name, (args) => executeCustomTool(ct, args));
  }

  // Integration (CRM / e-commerce) tools
  for (const name of enabled) {
    if (BUILTINS[name] || customs.some((c) => c.name === name)) continue;
    const it = resolveIntegrationTool(tenantId, name);
    if (it) {
      defs.push(it.def);
      runners.set(name, (args) => it.execute(args));
    }
  }

  // MCP server tools (fetched live; namespaced to avoid collisions)
  for (const serverId of bot.mcpServers ?? []) {
    const server = store.getMcpServer(serverId);
    if (!server) continue;
    try {
      const mcpTools = await mcpListTools(server);
      for (const td of mcpTools) {
        const ns = `mcp_${server.id.slice(0, 6)}__${td.name}`;
        defs.push({ ...td, name: ns });
        runners.set(ns, (args) => mcpCallTool(server, td.name, args));
      }
    } catch (err) {
      console.error(`[mcp] tools/list failed for ${server.name}:`, err);
    }
  }

  return {
    defs,
    async execute(name, args, ctx) {
      const runner = runners.get(name);
      if (!runner) return `Unknown tool: ${name}`;
      try {
        return await runner(args, ctx);
      } catch (err) {
        return `Tool "${name}" failed: ${err instanceof Error ? err.message : "error"}`;
      }
    },
  };
}
