import { runCodegen } from "@gtkx/codegen";
import { createLogger } from "@gtkx/utils";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const log = createLogger("gl");
const require = createRequire(import.meta.url);
const scriptDir = dirname(fileURLToPath(import.meta.url));

const registryPath = join(
    dirname(require.resolve("@gtkx/codegen/package.json")),
    "src",
    "khronos",
    "registry",
    "gl.xml",
);

const glSrcDir = join(scriptDir, "..", "src");
const outputDir = join(glSrcDir, "generated");
const EXPORT_PATTERN = /^export (?:async )?(?:function|const|type|interface|class) ([A-Za-z_$][\w$]*)/gm;
const overrideExports = overrideExportNames(join(glSrcDir, "overrides.ts"));

const result = await runCodegen({
    gl: { registryPath, overrideExports, outputDir, resolveFrom: join(scriptDir, "..") },
});

const report = result.gl;
const exclusionCounts: Map<string, number> = new Map();

function overrideExportNames(path: string): Set<string> {
    const source = readFileSync(path, "utf8");
    const names: Set<string> = new Set();

    for (const match of source.matchAll(EXPORT_PATTERN)) {
        const name = match[1];

        if (name !== undefined) {
            names.add(name);
        }
    }

    return names;
}

if (report === undefined) {
    throw new Error("gl codegen produced no report");
}

for (const exclusion of report.exclusions) {
    exclusionCounts.set(exclusion.reason, (exclusionCounts.get(exclusion.reason) ?? 0) + 1);
}

log.info(
    `khronos codegen: ${report.selection.api} ${String(report.selection.version)} ` +
    report.selection.profile,
);

log.info(
    `commands: ${String(report.selectedCommands)} selected, ${String(report.emittedCommands)} emitted, ` +
    `${String(report.derivedSingulars)} derived singulars, ${String(report.exclusions.length)} excluded`,
);
