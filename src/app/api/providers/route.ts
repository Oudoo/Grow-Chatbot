import { NextResponse } from "next/server";
import { globalDefaultProvider, providerCatalog } from "@/lib/llm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Provider catalog for the admin UI (labels + configured flags, no secrets). */
export async function GET() {
  return NextResponse.json({
    defaultProvider: globalDefaultProvider(),
    providers: providerCatalog(),
  });
}
