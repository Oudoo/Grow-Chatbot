// ElevenLabs — Text to Speech. Server-side only; the API key is never exposed.
// Produces natural Egyptian-Arabic speech when paired with an Egyptian voice
// from the ElevenLabs Voice Library (e.g. "Fathy Hammad", "Maged Magdy").
// The dialect comes from the chosen voice, not a locale code.

export const ELEVEN_MODEL =
  process.env.ELEVENLABS_MODEL_ID || "eleven_multilingual_v2";

export function elevenLabsVoiceId(): string {
  return process.env.ELEVENLABS_VOICE_ID ?? "";
}

export function elevenLabsConfigured(): boolean {
  return Boolean(process.env.ELEVENLABS_API_KEY && process.env.ELEVENLABS_VOICE_ID);
}

/** Synthesize speech via ElevenLabs; returns MP3 audio bytes. */
export async function synthesize(
  text: string,
  voiceId?: string,
  model?: string,
): Promise<ArrayBuffer> {
  const key = process.env.ELEVENLABS_API_KEY ?? "";
  const voice = voiceId || elevenLabsVoiceId();
  if (!key || !voice) {
    throw new Error("ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID must be set");
  }

  const url = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(
    voice,
  )}?output_format=mp3_44100_128`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "xi-api-key": key,
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
    },
    body: JSON.stringify({
      text,
      model_id: model || ELEVEN_MODEL,
      // Tuned for lively, natural conversational Egyptian delivery.
      voice_settings: {
        stability: 0.4,
        similarity_boost: 0.8,
        style: 0.35,
        use_speaker_boost: true,
      },
    }),
  });

  if (!res.ok) {
    const detail = (await res.text()).slice(0, 200);
    throw new Error(`ElevenLabs TTS failed (${res.status}): ${detail}`);
  }
  return res.arrayBuffer();
}
