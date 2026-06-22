---
name: forge-mcp
description: >-
  Use Forge MCP tools to create and manage Sarray Forge issues from repo work.
  Trigger when the user asks to file Forge issues, triage commits into issues,
  or use forge_create_issue / forge_search MCP tools.
---

# Forge MCP Workflow

## Prerequisites

1. Create an API key in Forge: **Settings → API Keys**
2. Copy `.cursor/mcp.json.example` to your user or project MCP config
3. Set `FORGE_TOKEN` to the `forge_…` secret (never commit it)
4. Set `FORGE_WORKSPACE` to the workspace key (default `FORGE`)

## When to create issues from repo work

Use this workflow when the user wants follow-up tasks tracked in Forge after code changes:

1. Inspect git history or diffs (`git log`, `git diff`, read changed files)
2. Call `forge_search` for each candidate title to avoid duplicates
3. Call `forge_create_issue` with:
   - **title**: concise action item
   - **description**: markdown with commit SHA, file links, and context
   - **labels**: include `agent` when created by automation
   - **priority**: `high` for bugs/regressions, `medium` for normal follow-ups

## Available MCP tools

| Tool | Use for |
|------|---------|
| `forge_list_workspaces` | Discover workspace keys |
| `forge_list_issues` | See existing board items |
| `forge_get_issue` | Read one issue before updating |
| `forge_create_issue` | File new work |
| `forge_update_issue` | Change status, assignee, etc. |
| `forge_search` | Dedup before creating |

## Example issue description

```markdown
## Context
Follow-up from commit abc1234.

## Changes reviewed
- `internal/handlers/workspace.go` — workspace scoping

## Suggested work
- Add integration test for invalid workspace header
```

## Do not

- Store API keys in the repository
- Create duplicate issues without searching first
- Use browser login/session cookies for automation — use API keys
