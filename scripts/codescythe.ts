import { spawnSync } from "node:child_process";
import { cpSync, mkdtempDisposableSync, realpathSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";
import config from "../codescythe.json" with { type: "json" };

/**
 * Codescythe skips node_modules even for explicit entries. A temporary copy lets it
 * follow the real generated consumers of private runtime and React exports.
 */
const root = fileURLToPath(new URL("../", import.meta.url));
using directory = mkdtempDisposableSync(join(root, ".codescythe-"));

for (const name of ["gi", "jsx"]) {
    cpSync(realpathSync(join(root, "node_modules", "@gtkx", name)), join(directory.path, name), { recursive: true });
}

const generated = `${basename(directory.path)}/**/*.{js,ts}`;
const configPath = join(directory.path, "codescythe.json");
writeFileSync(
    configPath,
    JSON.stringify({
        ...config,
        entry: [...config.entry, generated],
        project: [...config.project, generated],
    }),
);

const cli = fileURLToPath(import.meta.resolve("codescythe/bin/codescythe.js"));
const args = [cli, "--directory", root, "--config", configPath, ...process.argv.slice(2)];
const result = spawnSync(process.execPath, args, {
    cwd: root,
    stdio: "inherit",
});

if (result.error !== undefined) {
    throw result.error;
}

process.exitCode = result.status ?? 1;
