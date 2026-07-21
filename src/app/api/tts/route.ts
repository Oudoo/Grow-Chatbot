import { NextResponse } from "next/server";
import { synthesize, azureConfigured, AZURE_VOICE } from "@/lib/azure-tts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Report whether the native (Azure) Egyptian voice is configured. */
export async function GET() {
  return NextResponse.json({ configured: azureConfigured(), voice: AZURE_VOICE });
}

/** Synthesize Egyptian-Arabic speech from text; returns MP3 audio. */
export async function POST(req: Request) {
  if (!azureConfigured()) {
    return NextResponse.json(
      { error: "Azure TTS not configured (AZURE_SPEECH_KEY, AZURE_SPEECH_REGION)" },
      { status: 503 },
    );
  }
  let body: { text?: string; voice?: string };
  try {
    body = (await req.json()) as { text?: string; voice?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const text = String(body.text ?? "").trim().slice(0, 1500);
  if (!text) {
    return NextResponse.json({ error: "text is required" }, { status: 400 });
  }
  try {
    const audio = await synthesize(text, body.voice || AZURE_VOICE);
    return new NextResponse(Buffer.from(audio), {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "TTS failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
