import { spawnSync, type SpawnSyncReturns } from "node:child_process";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

type Entry = { name: string; arguments: string[] };

const WORKSPACE_ROOT = fileURLToPath(new URL("../../..", import.meta.url));
const CLI_PACKAGE = join(WORKSPACE_ROOT, "packages", "cli");
const CLI_ENTRY = join(CLI_PACKAGE, "dist", "cli.js");
const CONFIG_SOURCE = 'const { createConfigLoader } = await import("@gtkx/config/internal"); createConfigLoader();';
const VITEST_SOURCE = 'const { default: gtkx } = await import("@gtkx/vitest"); gtkx();';
const ENTRIES: Entry[] = [
    { name: "direct configuration loading", arguments: ["--input-type=module", "--eval", CONFIG_SOURCE] },
    { name: "the CLI", arguments: [CLI_ENTRY, "--help"] },
    { name: "the Vitest plugin", arguments: ["--input-type=module", "--eval", VITEST_SOURCE] },
];

const versionPreload = (version: string): string => {
    const source = `Object.defineProperty(process.versions, "node", { value: ${JSON.stringify(version)} });`;

    return `data:text/javascript,${encodeURIComponent(source)}`;
};

const runEntry = (entry: Entry, version?: string): SpawnSyncReturns<string> =>
    spawnSync(
        process.execPath,
        [...(version === undefined ? [] : ["--import", versionPreload(version)]), ...entry.arguments],
        {
            cwd: CLI_PACKAGE,
            encoding: "utf8",
        },
    );

const runEntryOrThrow = (entry: Entry, version: string): void => {
    const result = runEntry(entry, version);

    if (result.status !== 0) {
        throw new Error(`${result.stdout}${result.stderr}`);
    }
};

describe("the Node.js runtime preflight", () => {
    it.each(ENTRIES)("allows $name on the current supported runtime", (entry) => {
        expect(runEntry(entry).status).toBe(0);
    });

    it.each(ENTRIES)("allows $name at the minimum supported version", (entry) => {
        expect(runEntry(entry, "26.7.0").status).toBe(0);
    });

    it.each(ENTRIES)("rejects $name below the minimum supported version", (entry) => {
        expect(() => {
            runEntryOrThrow(entry, "26.6.0");
        }).toThrow();
    });
});
