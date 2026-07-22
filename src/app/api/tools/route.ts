import { NextResponse } from "next/server";
import * as store from "@/lib/store";
import { seedIfEmpty } from "@/lib/seed";
import { parseCustomToolInput } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  seedIfEmpty();
  const tenant = store.defaultTenant();
  return NextResponse.json({ tools: store.listCustomTools(tenant.id) });
}

export async function POST(req: Request) {
  const tenant = store.defaultTenant();
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = parseCustomToolInput(body, tenant.id);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const tool = store.createCustomTool(parsed.value);
  return NextResponse.json({ tool }, { status: 201 });
}
