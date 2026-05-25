# Installing loom

Three install paths for three surfaces.

## Prereqs

- Node.js ≥ 22 (LTS)
- git
- (Optional) Playwright + Chromium — only needed for axe-core a11y validation and forge rendering.

## A) Claude Code (plugin, recommended)

### From source

```bash
git clone <your-fork> loom
cd loom
npm install
npm run build
```

### Install the plugin

Claude Code reads plugins via `.claude-plugin/plugin.json` in the directory you point it at:

```bash
# From inside Claude Code, in any project:
/plugin install /absolute/path/to/loom
```

Or copy the plugin manifest into your global plugins dir:

```bash
mkdir -p ~/.claude/plugins/loom
cp -r .claude-plugin commands agents skills dist ~/.claude/plugins/loom/
```

Once installed, `/loom:start`, `/loom:new`, `/loom:token`, `/loom:component`, `/loom:route`,
`/loom:snapshot`, `/loom:validate`, `/loom:panel`, `/loom:forge`, `/loom:branch`, `/loom:export`,
`/loom:review`, and `/loom:doctor` are available.

The plugin's `loom-tools` MCP server starts automatically with Claude Code.
First start runs a one-time `npm install --omit=dev` in the plugin dir to fetch
the native SQLite binding (30–90s). Subsequent starts are instant.

## B) Claude Desktop (MCP)

Edit `claude_desktop_config.json` (location varies by OS):

- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`
- Linux: `~/.config/Claude/claude_desktop_config.json`

Merge in the snippet from `install/claude-desktop.mcp.json`, replacing the path:

```json
{
  "mcpServers": {
    "loom-tools": {
      "command": "node",
      "args": ["/absolute/path/to/loom/dist/mcp/server.js"]
    }
  }
}
```

Restart Claude Desktop. The full toolset under `loom-tools` is exposed.

## C) Codex CLI

Edit `~/.codex/config.toml` and append the snippet from `install/codex.config.toml`:

```toml
[mcp_servers.loom-tools]
command = "node"
args = ["/absolute/path/to/loom/dist/mcp/server.js"]
```

Run any Codex session and the tools are available.

## Optional dependencies

```bash
# A11y validation + forge rendering
npm install --save-optional playwright axe-core
npx playwright install chromium
```

## Smoke test

```bash
# Start the daemon
node dist/cli.js start

# In another shell:
curl http://127.0.0.1:5174/api/loom/healthz
# → {"status":"ok",...}

# Stop with Ctrl-C
```

## Troubleshooting

- **`better-sqlite3` fails to build on Windows.** Install Visual Studio Build Tools (C++).
- **Port 5174 in use.** Set `LOOM_PORT=5180 node dist/cli.js start`.
- **Daemon won't start: pid file present.** Stop the prior process or remove `~/.loom/server/pid`.
- **Plugin not detected by Claude Code.** Check that `.claude-plugin/plugin.json` exists and the `mcpServers.loom-tools.args` path resolves.
