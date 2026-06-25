import { NextResponse } from "next/server";
import { globalDefaultProvider, providerCatalog } from "@/lib/llm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    defaultProvider: globalDefaultProvider(),
    providers: providerCatalog(),
  });
}
