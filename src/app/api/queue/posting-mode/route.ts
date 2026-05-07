import { NextResponse } from "next/server";
import { getXPostingMode } from "@/lib/publisher/twitter";

export async function GET() {
  const mode = getXPostingMode();
  return NextResponse.json(mode);
}
