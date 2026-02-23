import { query } from "@anthropic-ai/claude-agent-sdk";
import { readFileSync } from "fs";
import { dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// --- Structured JSON line output ---
function emit(event: Record<string, unknown>) {
  process.stdout.write(JSON.stringify(event) + "\n");
}

// --- Parse args ---
let profileContent: string | undefined;
let repoPath: string | undefined;
let taskPrompt: string | undefined;
let resumeSessionId: string | undefined;
let resumeMessage: string | undefined;

const payloadIdx = process.argv.indexOf("--payload");
const resumeIdx = process.argv.indexOf("--resume");
const messageIdx = process.argv.indexOf("--message");

if (resumeIdx !== -1 && process.argv[resumeIdx + 1]) {
  resumeSessionId = process.argv[resumeIdx + 1];
  if (messageIdx !== -1 && process.argv[messageIdx + 1]) {
    resumeMessage = process.argv[messageIdx + 1];
  } else {
    console.error("--resume requires --message <text>");
    process.exit(1);
  }
} else if (payloadIdx !== -1 && process.argv[payloadIdx + 1]) {
  const payloadPath = process.argv[payloadIdx + 1];
  try {
    const payload = JSON.parse(readFileSync(payloadPath, "utf-8"));
    repoPath = payload.repoPath.replace(/^~/, process.env.HOME ?? "~");
    profileContent = payload.profileContent;
    taskPrompt = payload.taskPrompt;
  } catch (err) {
    console.error(`Failed to read payload file: ${payloadPath}`, err);
    process.exit(1);
  }
} else {
  console.error("Usage:");
  console.error(
    "  npx tsx agent-runner.ts --payload <json-file>"
  );
  console.error(
    "  npx tsx agent-runner.ts --resume <sessionId> --message <text>"
  );
  process.exit(1);
}

// --- Workflow system prompt addition ---
const COMMIT_CHUNK_PROMPT = `

## Workflow
Break your work into logical, reviewable commits. After completing each
coherent unit of work, stop and describe what you changed and why. Format
your pause as a JSON object on a single line:

{"type":"diff_ready","message":"<your commit message suggestion>"}

Wait for the user to approve before continuing.
Do not combine unrelated changes in one chunk.

When you receive "Changes committed. Continue with next chunk." — proceed with the next piece of work.
When you receive "Rejected: <feedback>. Please revise." — the changes have been reverted, revise based on the feedback.`;

// --- Resume mode ---
async function runResume() {
  for await (const message of query({
    prompt: resumeMessage!,
    options: {
      model: "claude-sonnet-4-5-20250929",
      resume: resumeSessionId!,
      allowedTools: ["Read", "Glob", "Grep", "Bash", "Edit", "Write"],
      permissionMode: "bypassPermissions",
      allowDangerouslySkipPermissions: true,
      maxBudgetUsd: 2.0,
      includePartialMessages: true,
      maxThinkingTokens: 10000,
    },
  })) {
    handleMessage(message);
  }
}

// --- First-run coding mode ---
async function runCoding() {
  const systemPrompt = `You are an expert software engineer. Your job is to implement changes in a codebase according to the task prompt and profile standards below.

You have full access to all tools: Read, Glob, Grep, Bash, Edit, Write.
Work carefully and methodically. Read existing code before modifying it.

${profileContent ?? ""}${COMMIT_CHUNK_PROMPT}`;

  emit({
    type: "text",
    content: `Starting coding session in ${repoPath}...\n\n`,
  });

  for await (const message of query({
    prompt: taskPrompt ?? "No task prompt provided.",
    options: {
      systemPrompt,
      model: "claude-sonnet-4-5-20250929",
      allowedTools: ["Read", "Glob", "Grep", "Bash", "Edit", "Write"],
      permissionMode: "bypassPermissions",
      allowDangerouslySkipPermissions: true,
      maxBudgetUsd: 2.0,
      cwd: repoPath,
      includePartialMessages: true,
      maxThinkingTokens: 10000,
    },
  })) {
    handleMessage(message);
  }
}

// --- Unified message handler ---
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function handleMessage(message: any) {
  if (message.type === "stream_event") {
    const event = message.event;
    if (event?.type === "content_block_delta") {
      const delta = event.delta;
      if (delta?.type === "thinking_delta" && delta.thinking) {
        emit({ type: "thinking", content: delta.thinking });
      } else if (delta?.type === "text_delta" && delta.text) {
        // Check if the text contains a diff_ready JSON
        const text = delta.text as string;
        if (text.includes('"type":"diff_ready"') || text.includes('"type": "diff_ready"')) {
          try {
            // Try to parse diff_ready from the text
            const match = text.match(/\{[^}]*"type"\s*:\s*"diff_ready"[^}]*\}/);
            if (match) {
              const parsed = JSON.parse(match[0]);
              emit({ type: "diff_ready", message: parsed.message ?? "" });
              // Emit any remaining text before/after
              const remaining = text.replace(match[0], "").trim();
              if (remaining) {
                emit({ type: "text", content: remaining });
              }
              return;
            }
          } catch {
            // Not valid JSON, fall through to regular text emit
          }
        }
        emit({ type: "text", content: text });
      }
    }
    return;
  }

  if (message.type === "assistant") {
    const content = message.message?.content;
    if (Array.isArray(content)) {
      for (const block of content) {
        if (block.type === "tool_use") {
          emit({ type: "tool_use", tool: block.name, input: block.input });
        }
        // Check full text blocks for diff_ready
        if (block.type === "text" && typeof block.text === "string") {
          const text = block.text;
          const match = text.match(/\{[^}]*"type"\s*:\s*"diff_ready"[^}]*\}/);
          if (match) {
            try {
              const parsed = JSON.parse(match[0]);
              emit({ type: "diff_ready", message: parsed.message ?? "" });
            } catch {
              // ignore parse failures
            }
          }
        }
      }
    }
    return;
  }

  if (message.type === "user") {
    const content = message.message?.content;
    if (Array.isArray(content)) {
      for (const block of content) {
        if (block.type === "tool_result") {
          const toolName = block.tool_name ?? "unknown";
          const output =
            typeof block.content === "string"
              ? block.content
              : JSON.stringify(block.content ?? "").slice(0, 500);
          emit({ type: "tool_result", tool: toolName, output });
        }
      }
    }
    return;
  }

  if (message.type === "result") {
    const data = message.result ?? null;
    const sessionId = message.session_id ?? null;
    emit({ type: "result", sessionId, data });
    return;
  }
}

// --- Main ---
async function main() {
  if (resumeSessionId) {
    await runResume();
  } else {
    await runCoding();
  }
}

main().catch((err) => {
  console.error("Agent runner failed:", err);
  process.exit(1);
});
