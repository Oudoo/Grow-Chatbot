// Azure Cognitive Services — Text to Speech with native Egyptian-Arabic
// neural voices. Server-side only; the subscription key is never exposed.

export const AZURE_VOICE = process.env.AZURE_SPEECH_VOICE || "ar-EG-SalmaNeural";

export function azureConfigured(): boolean {
  return Boolean(process.env.AZURE_SPEECH_KEY && process.env.AZURE_SPEECH_REGION);
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Synthesize Egyptian-Arabic speech; returns MP3 audio bytes. */
export async function synthesize(
  text: string,
  voice: string = AZURE_VOICE,
): Promise<ArrayBuffer> {
  const key = process.env.AZURE_SPEECH_KEY ?? "";
  const region = process.env.AZURE_SPEECH_REGION ?? "";
  if (!key || !region) {
    throw new Error("AZURE_SPEECH_KEY and AZURE_SPEECH_REGION must be set");
  }

  const url = `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`;
  const ssml = `<speak version='1.0' xml:lang='ar-EG'><voice name='${voice}'>${escapeXml(text)}</voice></speak>`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": key,
      "Content-Type": "application/ssml+xml",
      "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3",
      "User-Agent": "grow-chatbot",
    },
    body: ssml,
  });

  if (!res.ok) {
    const detail = (await res.text()).slice(0, 200);
    throw new Error(`Azure TTS failed (${res.status}): ${detail}`);
  }
  return res.arrayBuffer();
}
