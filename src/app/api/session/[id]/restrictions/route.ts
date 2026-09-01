import { NextResponse } from "next/server";
import { setRestriction, serializeSession } from "@/lib/kitty/store";
import { handleKittyError } from "@/lib/kitty/http";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const { name, token, restriction } = await req.json();
    const session = setRestriction(id, name, token, restriction);
    return NextResponse.json(serializeSession(session));
  } catch (err) {
    return handleKittyError(err);
  }
}
