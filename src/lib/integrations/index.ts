import * as store from "@/lib/store";
import type { Integration, IntegrationType } from "@/lib/types";
import type { ToolDef, ToolParameter } from "@/lib/tools/types";

// CRM / e-commerce connector catalog. Each connected integration contributes a
// set of tools to the bots that enable them. Tools return deterministic,
// clearly-labelled demo data; the `integration` (baseUrl/apiKey) is the seam
// where a real API call would go.

interface IntegrationTool {
  def: ToolDef;
  execute(args: Record<string, unknown>, integration: Integration): string;
}

function str(v: unknown, fallback = ""): string {
  return v === undefined || v === null ? fallback : String(v).trim();
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

function tool(
  name: string,
  description: string,
  params: Record<string, string>,
  required: string[],
  execute: IntegrationTool["execute"],
): IntegrationTool {
  const properties: Record<string, ToolParameter> = {};
  for (const [k, d] of Object.entries(params)) {
    properties[k] = { type: "string", description: d };
  }
  return {
    def: {
      name,
      description,
      parameters: { type: "object", properties, required },
      triggers: name.split(/[_\-\s]+/).filter(Boolean).map((s) => s.toLowerCase()),
    },
    execute,
  };
}

const tag = (i: Integration) => (i.baseUrl ? "live-config" : "demo");

const CATALOG: Record<
  IntegrationType,
  { label: string; tools: IntegrationTool[] }
> = {
  shopify: {
    label: "Shopify",
    tools: [
      tool(
        "shopify_get_order",
        "Get a Shopify order's fulfillment status and total.",
        { order_id: "Order number, e.g. #1001." },
        ["order_id"],
        (a, i) => {
          const id = str(a.order_id, "#0");
          const h = hash(id);
          const total = 20 + (h % 480);
          const st = ["paid", "fulfilled", "partially_fulfilled", "refunded"][
            h % 4
          ];
          return `[${tag(i)}] Shopify order ${id}: financial_status=paid; fulfillment=${st}; total=${total} USD.`;
        },
      ),
      tool(
        "shopify_find_product",
        "Find a Shopify product's price and inventory.",
        { query: "Product title or keyword." },
        ["query"],
        (a, i) => {
          const q = str(a.query, "item");
          const h = hash(q);
          return `[${tag(i)}] Shopify product "${q}": price=${10 + (h % 200)} USD; inventory=${h % 50} units.`;
        },
      ),
    ],
  },
  woocommerce: {
    label: "WooCommerce",
    tools: [
      tool(
        "woo_get_order",
        "Get a WooCommerce order status and total.",
        { order_id: "Order ID." },
        ["order_id"],
        (a, i) => {
          const id = str(a.order_id, "0");
          const h = hash(id);
          const st = ["processing", "completed", "on-hold", "cancelled"][h % 4];
          return `[${tag(i)}] Woo order #${id}: status=${st}; total=${15 + (h % 300)} USD.`;
        },
      ),
    ],
  },
  salesforce: {
    label: "Salesforce",
    tools: [
      tool(
        "sf_find_contact",
        "Find a Salesforce contact by name or email.",
        { query: "Name or email." },
        ["query"],
        (a, i) =>
          `[${tag(i)}] Salesforce contact "${str(a.query)}": account=Acme Corp; stage=Customer; owner=A. Rep.`,
      ),
      tool(
        "sf_create_lead",
        "Create a Salesforce lead.",
        { name: "Lead name.", email: "Lead email (optional)." },
        ["name"],
        (a, i) => {
          const id = `00Q${(hash(str(a.name)) % 1000000).toString().padStart(6, "0")}`;
          return `[${tag(i)}] Salesforce lead created: ${id} for ${str(a.name)}.`;
        },
      ),
    ],
  },
  hubspot: {
    label: "HubSpot",
    tools: [
      tool(
        "hubspot_find_contact",
        "Find a HubSpot contact by email.",
        { email: "Contact email." },
        ["email"],
        (a, i) =>
          `[${tag(i)}] HubSpot contact ${str(a.email)}: lifecycle=lead; last_activity=3 days ago.`,
      ),
      tool(
        "hubspot_create_deal",
        "Create a HubSpot deal.",
        { name: "Deal name.", amount: "Deal amount (optional)." },
        ["name"],
        (a, i) =>
          `[${tag(i)}] HubSpot deal "${str(a.name)}" created${a.amount ? ` (${str(a.amount)})` : ""}.`,
      ),
    ],
  },
  zoho: {
    label: "Zoho CRM",
    tools: [
      tool(
        "zoho_find_contact",
        "Find a Zoho CRM contact.",
        { query: "Name or email." },
        ["query"],
        (a, i) =>
          `[${tag(i)}] Zoho contact "${str(a.query)}": account=Beta LLC; status=active.`,
      ),
    ],
  },
};

export function integrationTypes(): { type: IntegrationType; label: string }[] {
  return (Object.keys(CATALOG) as IntegrationType[]).map((type) => ({
    type,
    label: CATALOG[type].label,
  }));
}

export function toolsForType(type: IntegrationType): string[] {
  return CATALOG[type]?.tools.map((t) => t.def.name) ?? [];
}

/** Tool names provided by all connected integrations for a tenant. */
export function integrationToolNames(tenantId: string): string[] {
  const names: string[] = [];
  for (const i of store.listIntegrations(tenantId)) {
    if (i.status !== "connected") continue;
    names.push(...toolsForType(i.type));
  }
  return names;
}

/** Resolve a tool name to a runnable integration tool for a tenant. */
export function resolveIntegrationTool(
  tenantId: string,
  name: string,
): { def: ToolDef; execute: (args: Record<string, unknown>) => string } | null {
  for (const integration of store.listIntegrations(tenantId)) {
    if (integration.status !== "connected") continue;
    const t = CATALOG[integration.type]?.tools.find((x) => x.def.name === name);
    if (t) {
      return { def: t.def, execute: (args) => t.execute(args, integration) };
    }
  }
  return null;
}
