import { NextResponse } from "next/server";
import { generateMessagesForInterventions } from "@/lib/agents/messagingAgent";

// Vercel Hobby plan max: 60s. Safety net for Gemini API calls.
export const maxDuration = 60;
export async function POST() {
  try {
    const result = await generateMessagesForInterventions();
    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    console.error("Error in generate-messages API route:", error);
    return NextResponse.json(
      { success: false, error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
