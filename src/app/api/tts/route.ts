import { NextResponse } from "next/server";
import * as eleven from "@/lib/elevenlabs-tts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Report whether the ElevenLabs Egyptian voice is configured. */
export async function GET() {
  const configured = eleven.elevenLabsConfigured();
  return NextResponse.json({
    configured,
    engine: configured ? "elevenlabs" : null,
    voice: configured ? eleven.elevenLabsVoiceId() : "",
  });
}

/** Synthesize Egyptian-Arabic speech from text via ElevenLabs; returns MP3. */
export async function POST(req: Request) {
  if (!eleven.elevenLabsConfigured()) {
    return NextResponse.json(
      {
        error:
          "ElevenLabs not configured. Set ELEVENLABS_API_KEY + ELEVENLABS_VOICE_ID.",
      },
      { status: 503 },
    );
  }

  let body: { text?: string; voice?: string; model?: string };
  try {
    body = (await req.json()) as { text?: string; voice?: string; model?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const text = String(body.text ?? "").trim().slice(0, 1500);
  if (!text) {
    return NextResponse.json({ error: "text is required" }, { status: 400 });
  }

  try {
    const audio = await eleven.synthesize(text, body.voice, body.model);
    return new NextResponse(Buffer.from(audio), {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
        "X-TTS-Engine": "elevenlabs",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "TTS failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
