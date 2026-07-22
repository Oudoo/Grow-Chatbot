import { NextResponse } from "next/server";
import * as store from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: { id: string } };

/** A human agent posts a reply into a conversation (handoff takeover). */
export async function POST(req: Request, { params }: Ctx) {
  const conversation = store.getConversation(params.id);
  if (!conversation)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body: { content?: string };
  try {
    body = (await req.json()) as { content?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const content = String(body.content ?? "").trim();
  if (!content)
    return NextResponse.json({ error: "content is required" }, { status: 400 });

  const message = store.addMessage({
    conversationId: params.id,
    role: "assistant",
    content,
    byAgent: true,
  });

  // An agent replying implies they've taken over the conversation.
  if (conversation.status !== "handoff") {
    store.updateConversation(params.id, { status: "handoff" });
  }

  return NextResponse.json({ message });
}
