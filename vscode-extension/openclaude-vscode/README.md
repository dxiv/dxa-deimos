# OpenClaude VS Code extension

Companion for the **OpenClaude** CLI: **Control Centre** in the activity bar, predictable terminal launches, and links to docs and your workspace profile.

## Features

- **Real Control Centre status** in the Activity Bar:
  - whether the configured `openclaude` command is installed
  - the launch command being used
  - whether the launch shim injects `CLAUDE_CODE_USE_OPENAI=1`
  - the current workspace folder
  - the launch cwd that will be used for terminal sessions
  - whether `.openclaude-profile.json` exists in the current workspace root
  - a conservative provider summary inferred from the workspace profile or known environment flags
- **Project-aware launch behaviour**:
  - `Launch OpenClaude` launches from the active editor's workspace when possible
  - falls back to the first workspace folder when needed
  - avoids launching from an arbitrary default cwd when a project is open
- **Practical sidebar actions**:
  - Launch OpenClaude
  - Launch in Workspace Root
  - Open Workspace Profile
  - Open Repository
  - Open Setup Guide
  - Open Command Palette
- **Built-in dark theme**: `OpenClaude Terminal Black`

## Requirements

- VS Code `1.95+`
- `openclaude` on the **same PATH** the integrated terminal uses (`npm install -g @dxiv/openclaude`). If the command is missing, see [Setup checklist](https://github.com/dxiv/OpenClaude/blob/main/docs/setup-checklist.md) and [Troubleshooting](https://github.com/dxiv/OpenClaude/blob/main/docs/troubleshooting.md).

After the CLI works, see [First run](https://github.com/dxiv/OpenClaude/blob/main/docs/first-run.md) for `/help` and `/provider`.

## Commands

- `OpenClaude: Open Control Centre`
- `OpenClaude: Launch in Terminal`
- `OpenClaude: Launch in Workspace Root`
- `OpenClaude: Open Repository`
- `OpenClaude: Open Setup Guide`
- `OpenClaude: Open Workspace Profile`

## Settings

- `openclaude.launchCommand` (default: `openclaude`)
- `openclaude.terminalName` (default: `OpenClaude`)
- `openclaude.useOpenAIShim` (default: `false`)

`openclaude.useOpenAIShim` only injects `CLAUDE_CODE_USE_OPENAI=1` into terminals launched by the extension. It does not guess or configure a provider by itself.

## Notes on Status Detection

- Provider status prefers the real workspace `.openclaude-profile.json` file when present.
- If no saved profile exists, the extension falls back to known environment flags available to the VS Code extension host.
- If the source of truth is unclear, the extension shows `unknown` instead of guessing.

## Development

From this folder:

```bash
npm run test
npm run lint
```

To package (optional):

```bash
npm run package
```

