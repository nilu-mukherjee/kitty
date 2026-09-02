import { NextResponse } from "next/server";
import { finalizeSession, serializeSession } from "@/lib/kitty/store";
import { handleKittyError, parseJsonBody } from "@/lib/kitty/http";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const { hostToken } = await parseJsonBody<{ hostToken: string }>(req);
    const session = finalizeSession(id, hostToken);
    return NextResponse.json(serializeSession(session));
  } catch (err) {
    return handleKittyError(err);
  }
}
