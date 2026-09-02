import { NextResponse } from "next/server";
import { addItem, removeItem, serializeSession } from "@/lib/kitty/store";
import { handleKittyError, parseJsonBody } from "@/lib/kitty/http";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const { name, token, itemId, qty, notes } = await parseJsonBody<{
      name: string;
      token: string;
      itemId: string;
      qty: number;
      notes?: string;
    }>(req);
    const session = addItem(id, name, token, itemId, qty, notes);
    return NextResponse.json(serializeSession(session));
  } catch (err) {
    return handleKittyError(err);
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const { name, token, lineId } = await parseJsonBody<{ name: string; token: string; lineId: string }>(req);
    const session = removeItem(id, name, token, lineId);
    return NextResponse.json(serializeSession(session));
  } catch (err) {
    return handleKittyError(err);
  }
}
