import { NextResponse } from "next/server";
import * as store from "@/lib/store";
import { parseBotInput } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: { id: string } };

export async function GET(_req: Request, { params }: Ctx) {
  const bot = store.getBot(params.id);
  if (!bot) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ bot });
}

export async function PUT(req: Request, { params }: Ctx) {
  const existing = store.getBot(params.id);
  if (!existing)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = parseBotInput(body, existing.tenantId);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const bot = store.updateBot(params.id, parsed.value);
  return NextResponse.json({ bot });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const ok = store.deleteBot(params.id);
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
