import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { fetchAllIndicesAdmin } from "@/lib/syntheticAdmin";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id || (session.user as any).role !== "admin") {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  try {
    const indices = await fetchAllIndicesAdmin();
    return NextResponse.json(indices);
  } catch (err) {
    console.error("[admin/synthetic] erro em GET /:", err);
    return NextResponse.json({ error: "erro ao consultar synthetic-engine" }, { status: 502 });
  }
}
