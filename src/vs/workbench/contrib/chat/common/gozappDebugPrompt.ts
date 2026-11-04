/* Licensed under the MIT License. */
export const GOZAPP_DEBUG_PROMPT = `---
name: gozapp-debug
description: Diagnose a reproducible bug with evidence before changing code
argument-hint: Describe expected behavior, actual behavior and reproduction steps
agent: agent
---
# Evidence-first debugging

Use the user's bug description and attached context. If missing, ask for expected versus actual behavior, reproduction steps, environment and a relevant error. Do not invent evidence or assume that old logs describe the current failure.

1. Inspect relevant code, callers and tests. State the reproduction procedure and a small set of competing hypotheses. Keep reads and tool output targeted.
2. Reproduce with an existing test or a minimal safe check. Report whether reproduction succeeded. If credentials, destructive actions or external services are needed, explain and ask permission. Do not repeatedly retry a failing external service.
3. Collect the smallest evidence that distinguishes the hypotheses. Temporary instrumentation requires an explicit explanation of what is collected, where it goes and how it is removed. Never log API keys, credentials, personal data or full request bodies; do not install a telemetry collector or bypass TLS.
4. Identify the root cause and affected files. If evidence is insufficient, stop and ask for the missing evidence rather than guessing a patch.
5. Make the smallest complete fix through tracked editor tools. Read current contents before editing; if a replacement fails, refresh the file and retry a smaller unique patch. Preserve unrelated user changes. Terminal rewrites are a last resort with user permission.
6. Add a focused regression test proving the failure and fix. Run relevant checks. Remove only temporary instrumentation you introduced, leaving unrelated user logs intact.
7. Report reproduction, root cause, changed files, tests actually run and remaining uncertainty. Ask the user to verify UI/hardware-specific behavior when you cannot. Do not approve edits on the user's behalf.

This workflow guides the model; it does not enforce permissions or implement automatic runtime instrumentation.
`;
