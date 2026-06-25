import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// A tiny, self-contained MCP server (JSON-RPC 2.0) so the MCP feature is
// demoable without any external infrastructure. Register this route's URL as an
// MCP server in the dashboard to list and call these tools.

const TOOLS = [
  {
    name: "echo",
    description: "Echo back the provided text.",
    inputSchema: {
      type: "object",
      properties: { text: { type: "string", description: "Text to echo." } },
      required: ["text"],
    },
  },
  {
    name: "add",
    description: "Add two numbers and return the sum.",
    inputSchema: {
      type: "object",
      properties: {
        a: { type: "number", description: "First number." },
        b: { type: "number", description: "Second number." },
      },
      required: ["a", "b"],
    },
  },
  {
    name: "now",
    description: "Return the current server time (ISO 8601).",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
];

function call(name: string, args: Record<string, unknown>): string {
  switch (name) {
    case "echo":
      return `echo: ${String(args.text ?? "")}`;
    case "add":
      return `sum = ${Number(args.a ?? 0) + Number(args.b ?? 0)}`;
    case "now":
      return new Date().toISOString();
    default:
      return `unknown tool: ${name}`;
  }
}

export async function POST(req: Request) {
  let body: { id?: unknown; method?: string; params?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({
      jsonrpc: "2.0",
      id: null,
      error: { code: -32700, message: "Parse error" },
    });
  }

  const id = body.id ?? null;
  const reply = (result: unknown) =>
    NextResponse.json({ jsonrpc: "2.0", id, result });

  switch (body.method) {
    case "initialize":
      return reply({
        protocolVersion: "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "grow-demo-mcp", version: "0.1.0" },
      });
    case "tools/list":
      return reply({ tools: TOOLS });
    case "tools/call": {
      const name = String(body.params?.name ?? "");
      const args = (body.params?.arguments ?? {}) as Record<string, unknown>;
      return reply({ content: [{ type: "text", text: call(name, args) }] });
    }
    default:
      return NextResponse.json({
        jsonrpc: "2.0",
        id,
        error: { code: -32601, message: `Method not found: ${body.method}` },
      });
  }
}
