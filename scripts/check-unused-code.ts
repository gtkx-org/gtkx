import { analyze } from "codescythe";
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

const forwardedArgs = process.argv.slice(2);

if (forwardedArgs.length === 0) {
    const analysis = analyze({ cwd: root, config: configPath });

    for (const file of Object.keys(analysis.issues.files)) {
        console.log(`unused file ${file}`);
    }

    for (const [file, exports] of Object.entries(analysis.issues.exports)) {
        for (const issue of Object.values(exports)) {
            console.log(`unused export ${file}:${String(issue.line)}:${String(issue.col)} ${issue.symbol}`);
        }
    }

    for (const [file, specifiers] of Object.entries(analysis.issues.unresolved ?? {})) {
        for (const specifier of specifiers) {
            console.log(`unresolved import ${file}: ${specifier}`);
        }
    }

    if (analysis.counters.files === 0 && analysis.counters.exports === 0 && analysis.counters.unresolved === 0) {
        console.log("No dead TypeScript code found");
    }

    process.exitCode = analysis.counters.files || analysis.counters.exports || analysis.counters.unresolved ? 1 : 0;
} else {
    const cli = fileURLToPath(import.meta.resolve("codescythe/bin/codescythe.js"));
    const result = spawnSync(process.execPath, [cli, "--directory", root, "--config", configPath, ...forwardedArgs], {
        cwd: root,
        stdio: "inherit",
    });

    if (result.error !== undefined) {
        throw result.error;
    }

    if (result.signal !== null) {
        throw new Error(`Codescythe terminated with signal ${result.signal}`);
    }

    process.exitCode = result.status ?? 1;
}
