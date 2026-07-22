import { NextResponse } from "next/server";
import * as azure from "@/lib/azure-tts";
import * as eleven from "@/lib/elevenlabs-tts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Engine = "elevenlabs" | "azure";

/** Preferred native TTS engine: ElevenLabs first, then Azure. */
function activeEngine(): Engine | null {
  if (eleven.elevenLabsConfigured()) return "elevenlabs";
  if (azure.azureConfigured()) return "azure";
  return null;
}

/** Report whether a native Egyptian voice is configured, and which engine. */
export async function GET() {
  const engine = activeEngine();
  const voice =
    engine === "elevenlabs"
      ? eleven.elevenLabsVoiceId()
      : engine === "azure"
        ? azure.AZURE_VOICE
        : "";
  return NextResponse.json({ configured: engine !== null, engine, voice });
}

/** Synthesize Egyptian-Arabic speech from text; returns MP3 audio. */
export async function POST(req: Request) {
  const engine = activeEngine();
  if (!engine) {
    return NextResponse.json(
      {
        error:
          "No TTS provider configured. Set ELEVENLABS_API_KEY + ELEVENLABS_VOICE_ID, or AZURE_SPEECH_KEY + AZURE_SPEECH_REGION.",
      },
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
    const audio =
      engine === "elevenlabs"
        ? await eleven.synthesize(text, body.voice)
        : await azure.synthesize(text, body.voice || azure.AZURE_VOICE);
    return new NextResponse(Buffer.from(audio), {
      headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "TTS failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
