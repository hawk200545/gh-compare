import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";

import { compareUsers } from "@/lib/github";
import { GitHubApiError } from "@/lib/github/client";
import { generateMeme } from "@/lib/meme";
import { comparisonInputSchema } from "@/lib/schemas";

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    const { userA, userB, refresh } = comparisonInputSchema.parse(payload);

    const comparison = await compareUsers(userA, userB, {
      forceRefresh: refresh,
    });

    const meme = await generateMeme(comparison.memePrompt);

    return NextResponse.json(
      {
        comparison,
        meme,
        cached: !refresh,
      },
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Invalid request", details: error.flatten() },
        { status: 400 },
      );
    }

    if (error instanceof GitHubApiError) {
      return NextResponse.json(
        { error: error.message, status: error.status },
        { status: error.status === 404 ? 404 : 502 },
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
