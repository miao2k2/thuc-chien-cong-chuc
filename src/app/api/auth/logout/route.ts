import { NextResponse } from "next/server";
import { destroySession, getCurrentUser } from "@/lib/auth";

export async function POST() {
  await destroySession();
  return NextResponse.json({ ok: true });
}

export async function GET() {
  const user = await getCurrentUser();
  return NextResponse.json({ user });
}
