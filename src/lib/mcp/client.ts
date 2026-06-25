import type { McpServer } from "@/lib/types";
import type { ToolDef, ToolParameter } from "@/lib/tools/types";

// Minimal MCP (Model Context Protocol) client over the Streamable HTTP
// transport: JSON-RPC 2.0 POSTed to a single endpoint. Responses may be plain
// JSON or SSE-framed (`data: {...}`); both are handled. This is intentionally
// small — enough to list and call tools from an MCP server.

interface JsonRpcResult {
  result?: unknown;
  error?: { message?: string };
}

interface McpRawTool {
  name: string;
  description?: string;
  inputSchema?: {
    properties?: Record<string, { type?: string; description?: string }>;
    required?: string[];
  };
}

function parseJsonRpc(text: string): JsonRpcResult {
  try {
    return JSON.parse(text) as JsonRpcResult;
  } catch {
    // SSE framing: take the last `data:` line that parses as JSON.
    const lines = text.split(/\r?\n/).filter((l) => l.startsWith("data:"));
    for (let i = lines.length - 1; i >= 0; i--) {
      try {
        return JSON.parse(lines[i].slice(5).trim()) as JsonRpcResult;
      } catch {
        /* keep scanning */
      }
    }
    throw new Error("Unparseable MCP response");
  }
}

async function mcpRequest(
  server: McpServer,
  method: string,
  params: Record<string, unknown>,
): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(server.url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
        ...(server.headers ?? {}),
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: Date.now(),
        method,
        params,
      }),
      signal: controller.signal,
    });
    const text = await res.text();
    const json = parseJsonRpc(text);
    if (json.error) throw new Error(json.error.message || "MCP error");
    return json.result;
  } finally {
    clearTimeout(timer);
  }
}

function toToolParam(p?: { type?: string; description?: string }): ToolParameter {
  const t = p?.type;
  const type =
    t === "number" || t === "integer"
      ? "number"
      : t === "boolean"
        ? "boolean"
        : "string";
  return { type, description: p?.description ?? "" };
}

/** List the tools a server exposes, mapped to our ToolDef shape. */
export async function mcpListTools(server: McpServer): Promise<ToolDef[]> {
  const result = (await mcpRequest(server, "tools/list", {})) as {
    tools?: McpRawTool[];
  };
  return (result.tools ?? []).map((t) => {
    const properties: Record<string, ToolParameter> = {};
    for (const [key, p] of Object.entries(t.inputSchema?.properties ?? {})) {
      properties[key] = toToolParam(p);
    }
    return {
      name: t.name,
      description: t.description ?? t.name,
      parameters: {
        type: "object",
        properties,
        required: t.inputSchema?.required ?? [],
      },
      triggers: t.name.split(/[_\-\s]+/).filter(Boolean).map((s) => s.toLowerCase()),
    };
  });
}

/** Call a tool on a server and return its text content. */
export async function mcpCallTool(
  server: McpServer,
  name: string,
  args: Record<string, unknown>,
): Promise<string> {
  const result = (await mcpRequest(server, "tools/call", {
    name,
    arguments: args,
  })) as { content?: { type: string; text?: string }[]; isError?: boolean };
  const text = (result.content ?? [])
    .filter((c) => c.type === "text")
    .map((c) => c.text ?? "")
    .join("")
    .trim();
  return text || "(no content)";
}
