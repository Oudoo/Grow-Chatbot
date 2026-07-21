import { NextResponse } from "next/server";
import {
  issueAccessToken,
  HUME_EVI_CONFIG_ID,
  humeConfigured,
} from "@/lib/hume";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Report whether the Hume (Maya) voice engine is configured — no secrets. */
export async function GET() {
  return NextResponse.json({ configured: humeConfigured() });
}

/** Issue a short-lived Hume access token for the client EVI connection. */
export async function POST() {
  try {
    if (!humeConfigured()) {
      return NextResponse.json(
        {
          error:
            "Hume voice is not configured. Set HUME_API_KEY, HUME_SECRET_KEY and HUME_EVI_CONFIG_ID.",
        },
        { status: 503 },
      );
    }
    const accessToken = await issueAccessToken();
    return NextResponse.json({ accessToken, configId: HUME_EVI_CONFIG_ID });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
