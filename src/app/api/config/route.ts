import { NextResponse } from "next/server";
import { getGatewayConfig } from "@/lib/gateway";

export async function GET() {
  const config = getGatewayConfig();
  return NextResponse.json(config);
}
