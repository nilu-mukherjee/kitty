import { NextResponse } from "next/server";
import { getSession, joinParticipant, leaveParticipant, serializeSession } from "@/lib/kitty/store";
import { handleKittyError, parseJsonBody } from "@/lib/kitty/http";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const { name, token } = await parseJsonBody<{ name: string; token: string }>(req);
    return NextResponse.json(serializeSession(joinParticipant(id, name, token)));
  } catch (err) {
    return handleKittyError(err);
  }
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    return NextResponse.json(serializeSession(getSession(id)));
  } catch (err) {
    return handleKittyError(err);
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const { name, token } = await parseJsonBody<{ name: string; token: string }>(req);
    return NextResponse.json(serializeSession(leaveParticipant(id, name, token)));
  } catch (err) {
    return handleKittyError(err);
  }
}
