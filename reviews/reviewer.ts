import { query } from "@anthropic-ai/claude-agent-sdk";
import { readFileSync } from "fs";
import { execSync } from "child_process";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// --- Structured JSON line output ---
function emit(event: Record<string, unknown>) {
  process.stdout.write(JSON.stringify(event) + "\n");
}

// --- Parse args ---
let profile: string | undefined;
let repoPath: string | undefined;
let resumeSessionId: string | undefined;
let resumeMessage: string | undefined;

const payloadIdx = process.argv.indexOf("--payload");
const profileIdx = process.argv.indexOf("--profile");
const resumeIdx = process.argv.indexOf("--resume");
const messageIdx = process.argv.indexOf("--message");

if (resumeIdx !== -1 && process.argv[resumeIdx + 1]) {
  // --resume mode: continue an existing session
  resumeSessionId = process.argv[resumeIdx + 1];
  if (messageIdx !== -1 && process.argv[messageIdx + 1]) {
    resumeMessage = process.argv[messageIdx + 1];
  } else {
    console.error("--resume requires --message <text>");
    process.exit(1);
  }
} else if (payloadIdx !== -1 && process.argv[payloadIdx + 1]) {
  // --payload mode: read JSON { repoPath, profileContent } from temp file
  const payloadPath = process.argv[payloadIdx + 1];
  try {
    const payload = JSON.parse(readFileSync(payloadPath, "utf-8"));
    repoPath = payload.repoPath.replace(/^~/, process.env.HOME ?? "~");
    profile = payload.profileContent;
  } catch (err) {
    console.error(`Failed to read payload file: ${payloadPath}`, err);
    process.exit(1);
  }
} else if (profileIdx !== -1 && process.argv[profileIdx + 1]) {
  // --profile mode: read from filesystem
  const profileName = process.argv[profileIdx + 1];
  const profilePath = resolve(__dirname, "profiles", `${profileName}.md`);

  try {
    profile = readFileSync(profilePath, "utf-8");
  } catch {
    console.error(`Profile not found: ${profilePath}`);
    console.error(
      "Available profiles:",
      execSync("ls profiles/", { cwd: __dirname, encoding: "utf-8" }).trim()
    );
    process.exit(1);
  }

  const repoMatch = profile.match(/^## Repo\n(.+)$/m);
  if (!repoMatch) {
    console.error("Profile missing '## Repo' section with repo path");
    process.exit(1);
  }
  repoPath = repoMatch[1].trim().replace(/^~/, process.env.HOME ?? "~");
} else {
  console.error("Usage:");
  console.error("  npx tsx reviewer.ts --profile <profile-name>");
  console.error("  npx tsx reviewer.ts --payload <json-file>");
  console.error("  npx tsx reviewer.ts --resume <sessionId> --message <text>");
  process.exit(1);
}

// --- Define structured output schema ---
const reviewSchema = {
  type: "object" as const,
  properties: {
    verdict: {
      type: "string" as const,
      enum: ["approve", "request_changes"],
      description:
        "Overall verdict: approve if no blockers, request_changes if blockers exist",
    },
    summary: {
      type: "string" as const,
      description: "1-2 sentence overall assessment of the changes",
    },
    findings: {
      type: "array" as const,
      items: {
        type: "object" as const,
        properties: {
          severity: {
            type: "string" as const,
            enum: ["blocker", "warning", "suggestion"],
          },
          file: {
            type: "string" as const,
            description: "Relative file path",
          },
          line: {
            type: "number" as const,
            description: "Approximate line number if applicable",
          },
          message: {
            type: "string" as const,
            description: "Clear description of the issue and how to fix it",
          },
        },
        required: ["severity", "message"],
      },
    },
  },
  required: ["verdict", "summary", "findings"],
};

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
      maxBudgetUsd: 0.50,
      includePartialMessages: true,
      maxThinkingTokens: 10000,
    },
  })) {
    handleMessage(message);
  }
}

// --- First-run review mode ---
async function runReview() {
  // Get uncommitted changes
  let diff: string;
  try {
    const staged = execSync("git diff --cached", {
      cwd: repoPath,
      encoding: "utf-8",
    });
    const unstaged = execSync("git diff", {
      cwd: repoPath,
      encoding: "utf-8",
    });
    diff = [staged, unstaged].filter(Boolean).join("\n");
  } catch (err) {
    console.error(`Failed to get git diff from ${repoPath}:`, err);
    process.exit(1);
  }

  if (!diff.trim()) {
    emit({ type: "text", content: "No uncommitted changes to review.\n" });
    process.exit(0);
  }

  // Get list of changed files for context
  const changedFiles = execSync(
    "git diff --name-only && git diff --cached --name-only",
    { cwd: repoPath, encoding: "utf-8", shell: "/bin/bash" }
  )
    .trim()
    .split("\n")
    .filter(Boolean)
    .filter((f, i, a) => a.indexOf(f) === i);

  emit({
    type: "text",
    content: `Reviewing ${changedFiles.length} changed file(s) in ${repoPath}...\n${changedFiles.map((f) => `  ${f}`).join("\n")}\n\n`,
  });

  const systemPrompt = `You are an expert code reviewer. Your job is to review uncommitted changes against a set of repo-specific standards.

Review the diff carefully. For each issue found, classify it by severity:
- blocker: Must fix before commit (security, broken logic, missing org-scoping, failing linters)
- warning: Should fix (DRY violations, missing tests, naming issues)
- suggestion: Nice to have (style, minor improvements)

If you need more context about the code, use the Read, Glob, and Grep tools to explore the codebase.
If linter checks are specified in the profile, run them with Bash.

Be thorough but fair. Don't flag things that are intentional or follow existing patterns in the codebase.

Here is the review profile:

${profile}`;

  const userPrompt = `Review these uncommitted changes:

Changed files: ${changedFiles.join(", ")}

\`\`\`diff
${diff}
\`\`\`

Use the available tools to read surrounding code for context if needed. Run any linter checks specified in the profile. Then produce your structured review.`;

  for await (const message of query({
    prompt: userPrompt,
    options: {
      systemPrompt,
      model: "claude-sonnet-4-5-20250929",
      allowedTools: ["Read", "Glob", "Grep", "Bash"],
      permissionMode: "bypassPermissions",
      allowDangerouslySkipPermissions: true,
      maxBudgetUsd: 0.50,
      cwd: repoPath,
      outputFormat: {
        type: "json_schema",
        schema: reviewSchema,
      },
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
        emit({ type: "text", content: delta.text });
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
    const data = message.structured_output ?? message.result ?? null;
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
    await runReview();
  }
}

main().catch((err) => {
  console.error("Review failed:", err);
  process.exit(1);
});
