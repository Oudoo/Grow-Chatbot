import * as store from "@/lib/store";
import type { Bot } from "@/lib/types";
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
// Tool registry. Each tool is a typed function the model can call mid-turn.
// In production these would hit real merchant / CRM / logistics APIs; here they
// are deterministic stand-ins so the agentic loop is fully demoable.
// ---------------------------------------------------------------------------
const TOOLS: Record<string, ToolImpl> = {
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
        CATALOG.find((p) => q && p.name.toLowerCase().split(" ").some((w) => q.includes(w)));
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
};

export function toolNames(): string[] {
  return Object.keys(TOOLS);
}

/** Resolve a list of tool names to their definitions (unknown names dropped). */
export function getToolDefs(names: string[]): ToolDef[] {
  return names.map((n) => TOOLS[n]?.def).filter((d): d is ToolDef => Boolean(d));
}

export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  ctx: ToolContext,
): Promise<string> {
  const impl = TOOLS[name];
  if (!impl) return `Unknown tool: ${name}`;
  try {
    return await impl.execute(args, ctx);
  } catch (err) {
    return `Tool "${name}" failed: ${err instanceof Error ? err.message : "error"}`;
  }
}
