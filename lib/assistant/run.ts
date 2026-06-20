import "server-only";

import { functionDeclarations, executeTool } from "./tools";

/**
 * Drives the Groq (OpenAI-compatible) function-calling loop for the QTMS
 * assistant.
 *
 * Flow: build a system prompt that includes the live list of languages (so the
 * model can map "Chinese Kanz ul Irfan" to the right row id), send the
 * conversation + tool catalogue to Groq, run whatever tools it asks for, feed
 * results back, and repeat until it produces a normal text reply.
 */

const GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
const MAX_TOOL_ROUNDS = 6;

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface OpenAIToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}
interface OpenAIMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: OpenAIToolCall[];
  tool_call_id?: string;
}

// Groq/OpenAI tool shape wraps each declaration in { type, function }.
const tools = functionDeclarations.map((d) => ({ type: "function", function: d }));

function buildSystemPrompt(): string {
  const today = new Date().toISOString().slice(0, 10);

  // Static + compact: no language list here (it's fetched on demand via
  // find_language), which keeps every request small on the free token budget.
  return `You are the assistant for QTMS (Quranic Translation Management System). Help the team check and update translation progress and meetings. Reply in the user's language/script (Roman Urdu if they use Roman Urdu). Be concise.

Today's date is ${today}.

Each project has languages; each language has 30 paras moving through stages.
Stage keys: translation, comparison, formation, convert_into_braille, tafteesh, designing, final_proof_reading.
Standard languages use translation, comparison, formation, tafteesh, designing, final_proof_reading. Braille languages use translation, comparison, convert_into_braille, tafteesh, final_proof_reading.

HOW TO ACT:
1. Whenever the user names a language, FIRST call find_language (search by the language word, e.g. "English"). The results include each match's project — if the user also named a project (e.g. "Sirat ul Jinan English"), pick the row whose project matches. If several still match, ask the user which one. Never invent an id.
2. Then use the id with the right tool.

READING — answering questions NEVER needs login. Just call the tool and reply:
- "how much work / what stage / kitna kaam / kahan tak" -> get_language_progress
- "last/previous meeting of a named language / aakhri meeting kab/kya hui" -> get_last_meeting
- "who do I meet today / aaj kis se meeting hai / aaj ki meetings / Monday ko kin se meeting / is hafte ka schedule / kal kis se" -> get_schedule (omit day for today; pass a weekday name for another day; pass "week" for the whole week). This is the planned recurring schedule — do NOT answer schedule questions with get_last_meeting.
Do NOT ask the user to log in for information questions. Never refuse a question because of login.

WRITING — only these two change data and require logged-in staff:
- update_stage_progress (record paras reached at a stage)
- log_meeting (record a meeting — first rewrite the user's rough notes into a clean summary)
Call them only when the user clearly wants to record or update something. ONLY if such a write tool returns PERMISSION_DENIED, tell the user they must log in to make changes. After a successful write, confirm exactly what was saved.`;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function callGroq(messages: OpenAIMessage[]): Promise<OpenAIMessage> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("MISSING_KEY");

  // Retry transient rate limits (429) using the wait time Groq suggests.
  const MAX_ATTEMPTS = 3;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages,
        tools,
        tool_choice: "auto",
        temperature: 0.3,
        max_tokens: 800,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      const msg = data?.choices?.[0]?.message as OpenAIMessage | undefined;
      if (!msg) throw new Error("GROQ_EMPTY");
      return msg;
    }

    const body = await res.text();

    if (res.status === 429 && attempt < MAX_ATTEMPTS) {
      // "Please try again in 14.84s" — wait that long (capped), then retry.
      const m = body.match(/try again in ([\d.]+)s/i);
      const waitSec = m ? Math.min(parseFloat(m[1]) + 0.5, 20) : 3;
      await sleep(waitSec * 1000);
      continue;
    }

    throw new Error(`GROQ_${res.status}: ${body.slice(0, 400)}`);
  }

  throw new Error("GROQ_RETRY_EXHAUSTED");
}

/** Run the assistant for a conversation and return its final text reply. */
export async function runAssistant(messages: ChatMessage[]): Promise<string> {
  if (!process.env.GROQ_API_KEY) {
    return "The AI assistant isn't configured yet — a GROQ_API_KEY needs to be added in the environment settings.";
  }

  const systemPrompt = buildSystemPrompt();

  const convo: OpenAIMessage[] = [
    { role: "system", content: systemPrompt },
    ...messages.map((m) => ({ role: m.role, content: m.content })),
  ];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const reply = await callGroq(convo);
    convo.push(reply);

    const calls = reply.tool_calls ?? [];

    if (calls.length === 0) {
      return (reply.content ?? "").trim() || "Sorry, I couldn't form a reply. Please try rephrasing.";
    }

    // Run every tool the model asked for, then feed the results back.
    for (const call of calls) {
      let args: Record<string, unknown> = {};
      try {
        args = call.function.arguments ? JSON.parse(call.function.arguments) : {};
      } catch {
        args = {};
      }
      const result = await executeTool(call.function.name, args);
      convo.push({
        role: "tool",
        tool_call_id: call.id,
        content: JSON.stringify(result),
      });
    }
  }

  return "That took too many steps — please try breaking your request into smaller parts.";
}
