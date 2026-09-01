import { NextResponse } from "next/server";
import { getSession, serializeSession } from "@/lib/kitty/store";
import { handleKittyError } from "@/lib/kitty/http";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    return NextResponse.json(serializeSession(getSession(id)));
  } catch (err) {
    return handleKittyError(err);
  }
}
