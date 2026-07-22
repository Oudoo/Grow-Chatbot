import { NextResponse } from "next/server";
import { globalDefaultProvider, providerCatalog } from "@/lib/llm";
import { elevenLabsConfigured, ELEVEN_MODEL } from "@/lib/elevenlabs-tts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    defaultProvider: globalDefaultProvider(),
    providers: providerCatalog(),
    // Voice config — presence-only diagnostics; secret values are never exposed.
    voice: {
      elevenLabsConfigured: elevenLabsConfigured(),
      model: ELEVEN_MODEL,
      env: {
        ELEVENLABS_API_KEY: Boolean(process.env.ELEVENLABS_API_KEY),
        ELEVENLABS_VOICE_ID: Boolean(process.env.ELEVENLABS_VOICE_ID),
        ELEVENLABS_MODEL_ID: Boolean(process.env.ELEVENLABS_MODEL_ID),
      },
    },
  });
}
