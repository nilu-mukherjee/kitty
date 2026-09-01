import { NextResponse } from "next/server";
import { KittyError } from "./store";

export function handleKittyError(err: unknown) {
  if (err instanceof KittyError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  console.error(err);
  return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
}
