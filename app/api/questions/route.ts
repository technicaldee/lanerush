import { NextResponse } from "next/server";
import type { OpenTdbApiResult } from "@/lib/opentdb";
import { mapOpenTdbToQuestions } from "@/lib/opentdb";

const OPENTDB = "https://opentdb.com/api.php?amount=15&category=9&type=multiple";

export async function GET() {
  try {
    const res = await fetch(OPENTDB, { next: { revalidate: 0 } });
    if (!res.ok) {
      return NextResponse.json({ error: "OpenTDB fetch failed" }, { status: 502 });
    }
    const data = (await res.json()) as OpenTdbApiResult;
    if (data.response_code !== 0 || !data.results?.length) {
      return NextResponse.json({ error: "No questions from OpenTDB" }, { status: 502 });
    }
    const questions = mapOpenTdbToQuestions(data.results);
    return NextResponse.json({ questions });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
