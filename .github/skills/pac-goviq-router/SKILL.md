---
name: pac-goviq-router
description: Route safe, read-only Power Platform governance questions to PAC GovIQ/Advisor ask commands and keep write actions in a plan-and-confirm flow.
---

# PAC GovIQ Router

Use this skill when users ask natural-language questions about Power Platform environments, apps, flows, governance posture, usage, or security summaries.

## Purpose

- Prefer read-only analysis through PAC GovIQ/Advisor ask commands.
- Avoid direct tenant-changing commands from natural-language prompts.
- For changes, require a clear plan and explicit user confirmation before execution.

## Command detection

1. Try GovIQ first:

```powershell
pac goviq ask help
```

2. If GovIQ does not exist, try Advisor:

```powershell
pac advisor ask help
```

3. Use whichever command exists:

- GovIQ form:

```powershell
pac goviq ask --question "<question>"
```

- Advisor form:

```powershell
pac advisor ask --question "<question>"
```

Add `--raw` when the user wants output that is easier to paste into notes or email.

## Guardrails

- Treat `ask` as read-only guidance.
- Do not execute tenant-altering commands based only on natural-language intent.
- If a user requests changes (delete, disable, update, assign, deploy, publish), provide a plan first and ask for explicit approval before running commands.

## Example prompts

- List all production environments.
- Which canvas apps have not been modified in 6 months?
- Give me a security overview for the tenant.
- Show orphaned apps and flows.
