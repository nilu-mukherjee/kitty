import { NextResponse } from "next/server";
import { MENU } from "@/lib/kitty/menu";

export async function GET() {
  return NextResponse.json({ menu: MENU });
}
