import type {
  NewBot,
  NewCustomTool,
  NewIntegration,
  NewMcpServer,
} from "@/lib/store";
import { listMcpServers } from "@/lib/store";
import type {
  BotProvider,
  Channel,
  CustomToolParam,
  Dialect,
  IntegrationType,
  Language,
  BotStatus,
} from "@/lib/types";
import { CHANNELS } from "@/lib/types";
import { toolNames } from "@/lib/tools";

const INTEGRATION_TYPES: IntegrationType[] = [
  "shopify",
  "woocommerce",
  "salesforce",
  "hubspot",
  "zoho",
];

const BUILTIN_TOOL_NAMES = new Set([
  "lookup_order",
  "product_lookup",
  "create_ticket",
  "escalate_to_human",
]);

function slug(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

const LANGS: Language[] = ["ar", "en"];
const DIALECTS: Dialect[] = [
  "auto",
  "msa",
  "gulf",
  "levantine",
  "egyptian",
  "maghrebi",
];
const PROVIDERS: BotProvider[] = [
  "default",
  "mock",
  "anthropic",
  "openai",
  "gemini",
];
const STATUSES: BotStatus[] = ["active", "draft"];

type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

function pick<T extends string>(val: unknown, allowed: T[], fallback: T): T {
  return typeof val === "string" && (allowed as string[]).includes(val)
    ? (val as T)
    : fallback;
}

/** Validate and normalise an incoming bot payload into a full NewBot record. */
export function parseBotInput(body: unknown, tenantId: string): Parsed<NewBot> {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Invalid request body" };
  }
  const b = body as Record<string, unknown>;
  const name = String(b.name ?? "").trim();
  if (!name) return { ok: false, error: "Name is required" };

  const language = pick<Language>(b.language, LANGS, "ar");
  let temperature = Number(b.temperature);
  if (!Number.isFinite(temperature) || temperature < 0 || temperature > 1) {
    temperature = 0.4;
  }

  const known = new Set(toolNames(tenantId));
  const tools = Array.isArray(b.tools)
    ? (b.tools as unknown[]).map((t) => String(t)).filter((t) => known.has(t))
    : [];

  const knownMcp = new Set(listMcpServers(tenantId).map((s) => s.id));
  const mcpServers = Array.isArray(b.mcpServers)
    ? (b.mcpServers as unknown[])
        .map((s) => String(s))
        .filter((s) => knownMcp.has(s))
    : [];

  const value: NewBot = {
    tenantId,
    name,
    description: String(b.description ?? "").trim(),
    language,
    dialect: pick<Dialect>(b.dialect, DIALECTS, "auto"),
    persona: String(b.persona ?? "").trim(),
    knowledge: String(b.knowledge ?? "").trim(),
    welcomeMessage:
      String(b.welcomeMessage ?? "").trim() ||
      (language === "ar"
        ? "مرحباً! كيف يمكنني مساعدتك؟"
        : "Hi! How can I help you?"),
    provider: pick<BotProvider>(b.provider, PROVIDERS, "default"),
    model: b.model ? String(b.model).trim() : undefined,
    temperature,
    tools,
    mcpServers,
    status: pick<BotStatus>(b.status, STATUSES, "active"),
  };
  return { ok: true, value };
}

export function parseChannel(val: unknown, fallback: Channel = "api"): Channel {
  return pick<Channel>(val, CHANNELS, fallback);
}

/** Validate an incoming MCP server registration. */
export function parseMcpServerInput(
  body: unknown,
  tenantId: string,
): Parsed<NewMcpServer> {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Invalid request body" };
  }
  const b = body as Record<string, unknown>;
  const name = String(b.name ?? "").trim();
  if (!name) return { ok: false, error: "Name is required" };
  const url = String(b.url ?? "").trim();
  if (!/^https?:\/\//i.test(url)) {
    return { ok: false, error: "URL must start with http:// or https://" };
  }
  let headers: Record<string, string> | undefined;
  if (b.headers && typeof b.headers === "object") {
    const h: Record<string, string> = {};
    for (const [k, v] of Object.entries(b.headers as Record<string, unknown>)) {
      const key = String(k).trim();
      if (key) h[key] = String(v);
    }
    if (Object.keys(h).length) headers = h;
  }
  return { ok: true, value: { tenantId, name, url, headers } };
}

/** Validate an incoming CRM / e-commerce integration. */
export function parseIntegrationInput(
  body: unknown,
  tenantId: string,
): Parsed<NewIntegration> {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Invalid request body" };
  }
  const b = body as Record<string, unknown>;
  const type = pick<IntegrationType>(b.type, INTEGRATION_TYPES, "shopify");
  const name = String(b.name ?? "").trim() || type;
  const baseUrl = b.baseUrl ? String(b.baseUrl).trim() : undefined;
  const apiKey = b.apiKey ? String(b.apiKey).trim() : undefined;
  return {
    ok: true,
    value: { tenantId, type, name, baseUrl, apiKey, status: "connected" },
  };
}

/** Validate and normalise an incoming custom HTTP tool payload. */
export function parseCustomToolInput(
  body: unknown,
  tenantId: string,
): Parsed<NewCustomTool> {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Invalid request body" };
  }
  const b = body as Record<string, unknown>;

  let name = slug(String(b.name ?? ""));
  if (!name) return { ok: false, error: "Tool name is required" };
  if (!/^[a-z]/.test(name)) name = `t_${name}`;
  if (BUILTIN_TOOL_NAMES.has(name)) {
    return { ok: false, error: "Name conflicts with a built-in tool" };
  }

  const description = String(b.description ?? "").trim();
  if (!description) return { ok: false, error: "Description is required" };

  const method = b.method === "POST" ? "POST" : "GET";

  const url = String(b.url ?? "").trim();
  if (!/^https?:\/\//i.test(url)) {
    return { ok: false, error: "URL must start with http:// or https://" };
  }

  const params: CustomToolParam[] = Array.isArray(b.params)
    ? (b.params as unknown[])
        .map((p) => {
          const pp = (p ?? {}) as Record<string, unknown>;
          return {
            name: slug(String(pp.name ?? "")),
            description: String(pp.description ?? "").trim(),
          };
        })
        .filter((p) => p.name)
    : [];

  let headers: Record<string, string> | undefined;
  if (b.headers && typeof b.headers === "object") {
    const h: Record<string, string> = {};
    for (const [k, v] of Object.entries(b.headers as Record<string, unknown>)) {
      const key = String(k).trim();
      if (key) h[key] = String(v);
    }
    if (Object.keys(h).length) headers = h;
  }

  const bodyTemplate = b.bodyTemplate ? String(b.bodyTemplate) : undefined;

  return {
    ok: true,
    value: { tenantId, name, description, method, url, headers, params, bodyTemplate },
  };
}
