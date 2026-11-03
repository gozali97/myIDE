# Gozapp Agent: implementation gaps

Comparison sources: https://cursor.com/docs/agent/overview.md,
https://cursor.com/docs/agent/plan-mode.md, https://cursor.com/docs/agent/agent-review.md.
This is a scoped source inspection, not a full product parity audit or runtime certification.

## Implemented in Gozapp
- Provider form, secret storage, per-model token budgets and tool/image capabilities.
- Custom endpoint output limit preservation and corrected cloned input budget.
- Optional senior developer and compact Ponytail-derived instructions.

## Existing upstream foundation, needs end-to-end verification
- Tracked edits, per-change review, changed-file lists and checkpoints.
- Plan agent (extensions/copilot/src/extension/agents/vscode-node/planAgentProvider.ts).
- Subagents, terminal permissions, MCP, automatic context compaction.
These must be tested with the configured external model, not presented as proven Cursor parity.

## Priority work
1. Agent activity: show last actual activity, distinguish model streaming, tools, permission waits and subagent work; surface network errors and cancellation. Never infer completion merely from lack of events. Test with a stalled mock stream and permission waits.
2. Edit recovery: reproduce failed tracked edits with exact log errors; handle stale content, duplicate matches and concurrent user edits. Prompt instructions alone are not a tool-engine fix. Preserve before/after review and avoid silent terminal fallbacks.
3. Model integration: probe tool calling and streaming with explicit user consent (may cost API tokens); distinguish configured capabilities from verified ones. Re-test switching models in long sessions.
4. Review regression: accept/reject one hunk, mixed user/agent edits, file creation/deletion, checkpoint restore and cancel mid-edit. Verify changed-file lists before claiming parity.
5. Make existing Plan agent discoverable; test read-only planning and explicit handoff before edits.
6. Browser verification, web search and repository retrieval: inventory available providers, configure credentials safely, then test against local apps and representative repositories. No claim of Cursor semantic-index quality yet.
7. Queue/steering, isolated worktrees and parallel agent UX: inspect existing upstream implementations before adding duplicates.

## Separate infrastructure projects
Cloud agents, custom autocomplete models, hosted indexing and provider-specific model tuning are not supplied by rebranding the editor. They need explicit architecture, cost/security decisions and evaluation.

## Boundaries
- External API usage can be billed even though the editor is free.
- Skills guide a model; they do not enforce permissions or guarantee token savings.
- No automatic approval of scripts, TLS bypass or silent overwriting of user work.
