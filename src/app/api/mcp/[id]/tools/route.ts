import { NextResponse } from "next/server";
import * as store from "@/lib/store";
import { mcpListTools } from "@/lib/mcp/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: { id: string } };

/** Probe a registered MCP server and return its advertised tools. */
export async function GET(_req: Request, { params }: Ctx) {
  const server = store.getMcpServer(params.id);
  if (!server) return NextResponse.json({ error: "Not found" }, { status: 404 });
  try {
    const tools = await mcpListTools(server);
    return NextResponse.json({
      tools: tools.map((t) => ({ name: t.name, description: t.description })),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "probe failed" },
      { status: 502 },
    );
  }
}
