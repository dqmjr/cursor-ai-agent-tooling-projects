import { markdownLinksPack } from "./markdown-links.js";
import { jsonSchemaPack } from "./json-schema.js";
import { secretsPack } from "./secrets.js";
import type { VerifierPack } from "../types.js";

const builtin: VerifierPack[] = [markdownLinksPack, jsonSchemaPack, secretsPack];

const registry = new Map<string, VerifierPack>(builtin.map((p) => [p.name, p]));

export function listPacks(): VerifierPack[] {
  return [...registry.values()];
}

export function getPack(name: string): VerifierPack | undefined {
  return registry.get(name);
}

export function registerPack(pack: VerifierPack): void {
  registry.set(pack.name, pack);
}
