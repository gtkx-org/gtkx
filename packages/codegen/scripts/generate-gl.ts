/**
 * Dev-time entry point for the Khronos GL generator.
 *
 * Reads the vendored `registry/gl.xml`, the hand-written companion module's
 * export names (for the disjointness assertion), and writes the generated
 * modules into `packages/gl/src/generated/`. Run via
 * `pnpm --filter @gtkx/codegen codegen:gl`; the emitted files are committed
 * and reviewed like any other source change.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { generateGlModules } from "../src/khronos/pipeline.js";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const registryPath = join(scriptDir, "..", "registry", "gl.xml");
const glSrcDir = join(scriptDir, "..", "..", "gl", "src");
const outputDir = join(glSrcDir, "generated");

const EXPORT_PATTERN = /^export (?:async )?(?:function|const|type|interface|class) ([A-Za-z_$][\w$]*)/gm;

const companionExportNames = (path: string): ReadonlySet<string> => {
    const source = readFileSync(path, "utf-8");
    const names = new Set<string>();
    for (const match of source.matchAll(EXPORT_PATTERN)) {
        const name = match[1];
        if (name !== undefined) names.add(name);
    }
    return names;
};

const companionExports = companionExportNames(join(glSrcDir, "companion.ts"));
const { files, report } = generateGlModules({ registryPath, companionExports });

mkdirSync(outputDir, { recursive: true });
for (const [fileName, source] of files) {
    writeFileSync(join(outputDir, fileName), source);
}

const exclusionCounts = new Map<string, number>();
for (const exclusion of report.exclusions) {
    exclusionCounts.set(exclusion.reason, (exclusionCounts.get(exclusion.reason) ?? 0) + 1);
}

console.log(`[gtkx] khronos codegen: ${report.selection.api} ${report.selection.version} ${report.selection.profile}`);
console.log(
    `[gtkx] commands: ${report.selectedCommands} selected, ${report.emittedCommands} emitted, ` +
        `${report.derivedSingulars} derived singulars, ${report.exclusions.length} excluded`,
);
for (const [reason, count] of [...exclusionCounts.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    console.log(`[gtkx]   excluded (${reason}): ${count}`);
}
console.log(`[gtkx] enums: ${report.selectedEnums} selected, ${report.emittedEnums} emitted`);
for (const skipped of report.skippedEnums) {
    console.log(`[gtkx]   skipped enum ${skipped.name}: ${skipped.reason}`);
}
