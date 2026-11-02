---
name: codex-gemini-pair
description: Coordinate Codex and Gemini as peer coding agents that propose strengths, agree on non-overlapping tasks, implement assigned work, and cross-review changes. Use when the user asks both agents to collaborate on a repository.
---

# Codex + Gemini pair workflow

Economy mode overrides the workflow below: every Antigravity invocation loads thousands of context tokens. Small changes use Codex alone. For a substantial task, delegate one independent IMPLEMENTATION to Flash Low. Use Claude Sonnet Low through Antigravity only for another independent deliverable or when explicitly requested. No negotiation, automatic review, or repeated mutual improvement by default. Codex integrates the worker's actual changes and runs focused deterministic tests. Do not regenerate code that a worker already wrote. For Roblox, request a self-contained Luau builder or controller, and let Codex insert it in Studio. Never claim another agent has direct Studio access without verifying it. Prefer supplied context over exploration. High effort and Argon need explicit request or an evidenced cheaper-model failure. Do not silently retry denied calls. Allowed paths are instructions, not an OS sandbox. get_usage reports Antigravity usage in this server session only, excluding Codex. Never promise percentage savings. Opening three apps does not make three agents collaborate; the free Claude Desktop chat cannot be invoked through this bridge.

The following negotiation/review sequence is optional and applies ONLY when the user explicitly requests that extra workflow, not for ordinary economy tasks:

1. Inspect the repository and restate the objective and acceptance criteria.
2. Write a short Codex proposal naming what Codex should own, what Gemini may own, relevant paths, risks, and review strengths.
3. Call `negotiate_task_split` once. Treat Gemini as a peer: consider its revisions and settle the split yourself using repository evidence.
4. Give each agent disjoint paths when possible. Codex handles its portion directly. Use `delegate_to_gemini` only for a concrete bounded task.
5. Use `flash-low` for routine exploration, tests, and mechanical edits. Use `argon-low` for negotiation and difficult reasoning. Increase effort only when evidence warrants it.
6. After implementation, inspect the actual diff and run focused tests. Call `review_with_gemini` when the change is substantial or Gemini is the designated reviewer.
7. Fix verified findings, rerun affected checks, and report each agent's contribution and the final validation.

Never send secrets, whole dependency trees, or unrelated files. Do not let both agents edit the same file concurrently. Do not accept a review claim without checking the repository or test output.
