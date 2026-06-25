import { NextResponse } from "next/server";
import * as store from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const botId = searchParams.get("botId") ?? undefined;
  const tenant = store.defaultTenant();
  const conversations = store.listConversations({
    tenantId: tenant.id,
    botId,
  });
  return NextResponse.json({ conversations });
}
