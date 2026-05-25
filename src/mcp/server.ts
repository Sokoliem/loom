import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { registerAllTools } from "./registry.js";

async function main(): Promise<void> {
  const server = new Server(
    { name: "loom-tools", version: "0.9.0" },
    { capabilities: { tools: {} } },
  );

  const registry = registerAllTools();

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: registry.list(),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const tool = registry.get(req.params.name);
    if (!tool) {
      throw new McpError(ErrorCode.MethodNotFound, `unknown tool: ${req.params.name}`);
    }
    try {
      const result = await tool.handler(req.params.arguments ?? {});
      return {
        content: [
          {
            type: "text",
            text: typeof result === "string" ? result : JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (err: unknown) {
      const e = err as { code?: string; message?: string; hint?: string };
      const message = e.message ?? String(err);
      const text =
        e.code && e.code.startsWith("E_")
          ? JSON.stringify({ ok: false, code: e.code, message, hint: e.hint })
          : JSON.stringify({ ok: false, code: "E_INTERNAL", message });
      return { content: [{ type: "text", text }], isError: true };
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write("loom-tools MCP server ready on stdio\n");
}

main().catch((err) => {
  process.stderr.write(`loom-tools fatal: ${err.message}\n`);
  process.exit(1);
});
