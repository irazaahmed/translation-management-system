import { NextResponse } from "next/server";
import { runAssistant, type ChatMessage } from "@/lib/assistant/run";

export const dynamic = "force-dynamic";

/** POST { messages: [{role, content}] } -> { reply } */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const raw = Array.isArray(body?.messages) ? body.messages : [];

    // Keep the last ~20 turns; sanitize shape.
    const messages: ChatMessage[] = raw
      .filter(
        (m: unknown): m is ChatMessage =>
          !!m &&
          typeof (m as ChatMessage).content === "string" &&
          ((m as ChatMessage).role === "user" || (m as ChatMessage).role === "assistant")
      )
      .slice(-20);

    if (messages.length === 0) {
      return NextResponse.json({ error: "No message provided." }, { status: 400 });
    }

    const reply = await runAssistant(messages);
    return NextResponse.json({ reply });
  } catch (err) {
    console.error("Assistant route failed:", err);
    const message =
      err instanceof Error && err.message.startsWith("GEMINI_")
        ? "The AI service returned an error. Please try again in a moment."
        : "Something went wrong. Please try again.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
