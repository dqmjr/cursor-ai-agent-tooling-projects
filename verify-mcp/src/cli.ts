#!/usr/bin/env node
/**
 * verify-mcp CLI
 *
 *   verify-mcp serve          # stdio MCP server
 *   verify-mcp run -p secrets --path ./src
 *   verify-mcp packs
 */

import { Command } from "commander";
import { startServer } from "./server.js";
import { getPack, listPacks } from "./packs/index.js";

const program = new Command();

program
  .name("verify-mcp")
  .description("Pluggable verification-as-a-tool MCP server")
  .version("0.1.0");

program
  .command("serve")
  .description("Run as an MCP server on stdio")
  .action(async () => {
    await startServer();
  });

program
  .command("packs")
  .description("List built-in verifier packs")
  .action(() => {
    for (const p of listPacks()) {
      console.log(`${p.name}\t${p.description}`);
    }
  });

program
  .command("run")
  .description("Run verifier packs from the CLI (no MCP host required)")
  .requiredOption("--path <path>", "File or directory to verify")
  .option("-p, --pack <name>", "Pack name (repeatable)", (v, acc: string[]) => {
    acc.push(v);
    return acc;
  }, [] as string[])
  .option("--schema-path <path>", "JSON Schema path for json-schema pack")
  .option("--content <text>", "Inline content instead of reading path")
  .action(async (opts: {
    path: string;
    pack: string[];
    schemaPath?: string;
    content?: string;
  }) => {
    const names = opts.pack.length ? opts.pack : listPacks().map((p) => p.name);
    const options: Record<string, unknown> = {};
    if (opts.schemaPath) options.schemaPath = opts.schemaPath;

    const results = [];
    for (const name of names) {
      const pack = getPack(name);
      if (!pack) {
        console.error(`Unknown pack: ${name}`);
        process.exitCode = 1;
        continue;
      }
      const result = await pack.verify({
        path: opts.path,
        content: opts.content,
        options,
      });
      results.push(result);
      console.log(JSON.stringify(result, null, 2));
    }
    if (results.some((r) => !r.pass)) process.exitCode = 1;
  });

// Default: serve (so mcp.json can launch `verify-mcp` / `node dist/cli.js`)
if (process.argv.length <= 2) {
  await startServer();
} else {
  await program.parseAsync(process.argv);
}
