import { NextResponse } from "next/server";
import { generateMessagesForInterventions } from "@/lib/agents/messagingAgent";

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
