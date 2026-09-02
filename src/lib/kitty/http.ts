import { NextResponse } from "next/server";
import { KittyError } from "./store";

export async function parseJsonBody<T = unknown>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new KittyError("Invalid JSON body", 400);
  }
}

export function handleKittyError(err: unknown) {
  if (err instanceof KittyError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  console.error(err);
  return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
}
