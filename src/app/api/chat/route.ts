import { NextResponse } from "next/server";
import { processTurn, EngineError } from "@/lib/engine/chat";
import { parseChannel } from "@/lib/validation";
import * as store from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Permissive CORS so the endpoint can power the embeddable widget and external
// channels calling in from any origin.
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

/**
 * Public polling endpoint: fetch a conversation's messages and status so a
 * widget can receive replies from a human agent during a handoff.
 * `GET /api/chat?conversationId=...`
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const conversationId = searchParams.get("conversationId");
  if (!conversationId) {
    return NextResponse.json(
      { error: "conversationId is required" },
      { status: 400, headers: CORS },
    );
  }
  const conversation = store.getConversation(conversationId);
  if (!conversation) {
    return NextResponse.json(
      { error: "Not found" },
      { status: 404, headers: CORS },
    );
  }
  const messages = store.listMessages(conversationId).map((m) => ({
    id: m.id,
    role: m.role,
    content: m.content,
    byAgent: m.byAgent ?? false,
    tools: m.tools ?? [],
    createdAt: m.createdAt,
  }));
  return NextResponse.json(
    { status: conversation.status, messages },
    { headers: CORS },
  );
}

/**
 * Channel-agnostic message ingestion. Any channel (web widget, WhatsApp,
 * Messenger, …) posts the same shape and receives the bot's reply.
 *
 * Body: { botId, message, conversationId?, channel?, endUserName? }
 */
export async function POST(req: Request) {
  let body: {
    botId?: string;
    message?: string;
    conversationId?: string;
    channel?: string;
    endUserName?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON" },
      { status: 400, headers: CORS },
    );
  }

  if (!body.botId || !body.message) {
    return NextResponse.json(
      { error: "botId and message are required" },
      { status: 400, headers: CORS },
    );
  }

  try {
    const result = await processTurn({
      botId: body.botId,
      conversationId: body.conversationId,
      channel: parseChannel(body.channel, "web"),
      text: body.message,
      endUserName: body.endUserName,
    });

    return NextResponse.json(
      {
        conversationId: result.conversation.id,
        reply: result.assistantMessage?.content ?? null,
        messageId: result.assistantMessage?.id,
        userMessageId: result.userMessage.id,
        sentiment: result.userMessage.sentiment,
        meta: result.meta,
        tools: result.toolInvocations,
        status: result.conversation.status,
        handoff: result.handoff,
      },
      { headers: CORS },
    );
  } catch (err) {
    const status = err instanceof EngineError ? 400 : 500;
    const message =
      err instanceof Error ? err.message : "Unexpected engine error";
    if (status === 500) console.error("[api/chat]", err);
    return NextResponse.json({ error: message }, { status, headers: CORS });
  }
}
