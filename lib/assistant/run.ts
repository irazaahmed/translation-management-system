import "server-only";

import { getCachedLanguages, getCachedProjects } from "@/lib/cachedData";
import { functionDeclarations, executeTool } from "./tools";

/**
 * Drives the Gemini (free tier) function-calling loop for the QTMS assistant.
 *
 * Flow: build a system prompt that includes the live list of languages (so the
 * model can map "Chinese Kanz ul Irfan" to the right row id), send the
 * conversation + tool catalogue to Gemini, run whatever tools it asks for, feed
 * results back, and repeat until it produces a normal text reply.
 */

const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash";
const MAX_TOOL_ROUNDS = 6;

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface GeminiPart {
  text?: string;
  functionCall?: { name: string; args?: Record<string, unknown>; id?: string };
  functionResponse?: { name: string; id?: string; response: Record<string, unknown> };
}
interface GeminiContent {
  role: "user" | "model";
  parts: GeminiPart[];
}

async function buildSystemPrompt(): Promise<string> {
  const [languages, projects] = await Promise.all([
    getCachedLanguages(),
    getCachedProjects(),
  ]);
  const projectName = new Map(projects.map((p) => [p.id, p.name]));

  const list = languages
    .map((l) => {
      const proj = l.project_id ? projectName.get(l.project_id) ?? "—" : "—";
      return `- id=${l.id} | ${l.language} (${l.country}) | project: ${proj} | status: ${l.work_status}`;
    })
    .join("\n");

  const today = new Date().toISOString().slice(0, 10);

  return `You are the assistant for QTMS (Quranic Translation Management System). You help the team check and update translation progress and meetings. Reply in the same language/script the user writes in (Roman Urdu if they use Roman Urdu). Be concise and friendly.

Today's date is ${today}.

DATA MODEL:
- Each project has languages. Each language has 30 paras moving through stages.
- Standard pipeline: Translation, Comparison, Formation, Tafteesh, Designing, Final Proof Reading.
- Braille languages use: Translation (for Braille), Comparison, Convert into Braille, Tafteesh, Final Proof Reading.
- Stage keys for tools: translation, comparison, formation, convert_into_braille, tafteesh, designing, final_proof_reading.

YOU HAVE THESE LANGUAGES (always pass the exact id to tools):
${list}

RULES:
- To answer "how much work is done" or "what stage" → call get_language_progress.
- To answer "last meeting" → call get_last_meeting.
- To record progress (e.g. "10 paras Final Proof Reading done") → call update_stage_progress with the right stage key.
- To record a meeting → call log_meeting. Clean up and rewrite the user's rough notes into a clear discussion summary before saving.
- If the user's words match more than one language, ask them which one before acting. Never guess an id that isn't in the list.
- Writing (update_stage_progress, log_meeting) needs the user to be logged-in staff. If a tool returns PERMISSION_DENIED, tell the user they must log in to make changes — do not retry.
- After a successful write, confirm exactly what you saved.`;
}

async function callGemini(
  systemPrompt: string,
  contents: GeminiContent[]
): Promise<GeminiContent> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("MISSING_KEY");

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents,
        tools: [{ functionDeclarations }],
      }),
    }
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GEMINI_${res.status}: ${body.slice(0, 300)}`);
  }

  const data = await res.json();
  const candidate = data?.candidates?.[0]?.content as GeminiContent | undefined;
  if (!candidate) throw new Error("GEMINI_EMPTY");
  return candidate;
}

/** Run the assistant for a conversation and return its final text reply. */
export async function runAssistant(messages: ChatMessage[]): Promise<string> {
  if (!process.env.GEMINI_API_KEY) {
    return "The AI assistant isn't configured yet — a GEMINI_API_KEY needs to be added in the environment settings.";
  }

  const systemPrompt = await buildSystemPrompt();

  const contents: GeminiContent[] = messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const reply = await callGemini(systemPrompt, contents);
    contents.push(reply);

    const calls = (reply.parts || []).filter((p) => p.functionCall);

    if (calls.length === 0) {
      const text = (reply.parts || [])
        .map((p) => p.text)
        .filter(Boolean)
        .join("\n")
        .trim();
      return text || "Sorry, I couldn't form a reply. Please try rephrasing.";
    }

    // Run every tool the model asked for, then feed the results back.
    const responseParts: GeminiPart[] = [];
    for (const part of calls) {
      const fc = part.functionCall!;
      const result = await executeTool(fc.name, fc.args ?? {});
      responseParts.push({
        functionResponse: {
          name: fc.name,
          ...(fc.id ? { id: fc.id } : {}),
          response: result as Record<string, unknown>,
        },
      });
    }
    contents.push({ role: "user", parts: responseParts });
  }

  return "That took too many steps — please try breaking your request into smaller parts.";
}
