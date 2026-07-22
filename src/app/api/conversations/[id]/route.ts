import { NextResponse } from "next/server";
import * as store from "@/lib/store";
import type { ConversationStatus } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: { id: string } };

const STATUSES: ConversationStatus[] = ["open", "closed", "handoff"];

export async function GET(_req: Request, { params }: Ctx) {
  const conversation = store.getConversation(params.id);
  if (!conversation)
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  const messages = store.listMessages(params.id);
  return NextResponse.json({ conversation, messages });
}

export async function PATCH(req: Request, { params }: Ctx) {
  const conversation = store.getConversation(params.id);
  if (!conversation)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body: { status?: string };
  try {
    body = (await req.json()) as { status?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const status =
    body.status && (STATUSES as string[]).includes(body.status)
      ? (body.status as ConversationStatus)
      : undefined;
  if (!status)
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });

  const updated = store.updateConversation(params.id, { status });
  return NextResponse.json({ conversation: updated });
}
