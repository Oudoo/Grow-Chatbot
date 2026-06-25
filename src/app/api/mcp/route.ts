import { NextResponse } from "next/server";
import * as store from "@/lib/store";
import { seedIfEmpty } from "@/lib/seed";
import { parseMcpServerInput } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  seedIfEmpty();
  const tenant = store.defaultTenant();
  return NextResponse.json({ servers: store.listMcpServers(tenant.id) });
}

export async function POST(req: Request) {
  const tenant = store.defaultTenant();
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = parseMcpServerInput(body, tenant.id);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const server = store.createMcpServer(parsed.value);
  return NextResponse.json({ server }, { status: 201 });
}
