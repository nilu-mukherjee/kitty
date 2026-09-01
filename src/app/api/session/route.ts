import { NextResponse } from "next/server";
import { createSession, serializeSession } from "@/lib/kitty/store";

export async function POST() {
  const session = createSession();
  return NextResponse.json({
    id: session.id,
    hostToken: session.hostToken,
    session: serializeSession(session),
  });
}
