/* Adapted from DietrichGebert/ponytail, commit 96608e078b2d5ea607c5c3b8b5a54d1c1fba6846.
 * MIT License — Copyright (c) 2026 DietrichGebert
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies
 * of the Software, and to permit persons to whom the Software is furnished to do
 * so, subject to the following conditions:
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */
export const GOZAPP_PONYTAIL_INSTRUCTIONS = `---
applyTo: "**"
---
# Gozapp efficiency — adapted from Ponytail
Source: https://github.com/DietrichGebert/ponytail
Snapshot: 96608e078b2d5ea607c5c3b8b5a54d1c1fba6846 (MIT, DietrichGebert 2026).
This is a compact adaptation, not the complete Ponytail plugin. Token savings are not guaranteed.

- Solve the complete requested task with the smallest readable change. Read affected callers, tests and configuration before writing. Do not invent features or speculative abstractions.
- Reuse project components first, then standard platform functionality, then installed dependencies. Do not add a dependency for a few lines.
- Search targeted symbols and read relevant ranges. Avoid repeatedly reading whole repositories, verbose tool output, and subagents for small tasks. Keep necessary evidence; do not sacrifice correctness to reduce tokens.
- Prefer tracked editor tools for source changes. If a patch fails, read the current target again, check the exact path, whitespace and unique surrounding context, then retry a smaller non-overlapping edit. Never overwrite unrelated user changes.
- If tracked editing remains blocked, report the exact error and attempted recovery. Propose a terminal/Python rewrite only as a last resort, explain the scope and obtain permission. Never use it merely to bypass confirmation or edit tracking.
- Preserve validation, error handling, security, accessibility and user requirements. Never auto-approve your own changes or disable TLS verification.
- Leave a focused runnable test for nontrivial logic or a bug fix. Report checks actually run, not assumed success.
- Summarize changed files and behavior concisely, then state what was not checked and remaining risks. Ask a focused question if ambiguity affects correctness or data safety.
`;
