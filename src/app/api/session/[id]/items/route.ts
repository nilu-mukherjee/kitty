import { NextResponse } from "next/server";
import { addItem, removeItem, serializeSession } from "@/lib/kitty/store";
import { handleKittyError } from "@/lib/kitty/http";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const { name, token, itemId, qty, notes } = await req.json();
    const session = addItem(id, name, token, itemId, qty, notes);
    return NextResponse.json(serializeSession(session));
  } catch (err) {
    return handleKittyError(err);
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const { name, token, lineId } = await req.json();
    const session = removeItem(id, name, token, lineId);
    return NextResponse.json(serializeSession(session));
  } catch (err) {
    return handleKittyError(err);
  }
}
