// Server-side Hume helpers (ported from Centro AI Recruiter).
// Direct fetch to Hume's OAuth2 client-credentials token endpoint — stable and
// version-independent, keeps the server bundle small.

const HUME_TOKEN_ENDPOINT = "https://api.hume.ai/oauth2-cc/token";

export const HUME_EVI_CONFIG_ID = process.env.HUME_EVI_CONFIG_ID ?? "";

/** True when all Hume voice credentials are present. */
export function humeConfigured(): boolean {
  return Boolean(
    process.env.HUME_API_KEY &&
      process.env.HUME_SECRET_KEY &&
      process.env.HUME_EVI_CONFIG_ID,
  );
}

export async function issueAccessToken(): Promise<string> {
  const apiKey = process.env.HUME_API_KEY ?? "";
  const secretKey = process.env.HUME_SECRET_KEY ?? "";
  if (!apiKey || !secretKey) {
    throw new Error(
      "HUME_API_KEY and HUME_SECRET_KEY must be set in the environment",
    );
  }

  const credentials = Buffer.from(`${apiKey}:${secretKey}`).toString("base64");

  const res = await fetch(HUME_TOKEN_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Hume token issuance failed (${res.status}): ${text}`);
  }

  const data = (await res.json()) as { access_token?: string };
  if (!data.access_token) {
    throw new Error("Hume token response missing access_token field");
  }
  return data.access_token;
}
