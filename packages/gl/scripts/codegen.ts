import { runGlCodegen } from "@gtkx/codegen/internal";
import { createLogger } from "@gtkx/utils";
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
const overridePath = join(glSrcDir, "overrides.ts");
const report = runGlCodegen({ registryPath, overridePath, outputDir, resolveFrom: join(scriptDir, "..") });
const exclusionCounts: Map<string, number> = new Map();

function summarizeCounts(counts: Map<string, number>): string {
    return [...counts]
        .toSorted(([left], [right]) => left.localeCompare(right))
        .map(([reason, count]) => `${reason} ${String(count)}`)
        .join(", ");
}

function summarizeEnumExclusions(tokens: string[]): string {
    return tokens.map((token) => `${token}: unrepresentable`).join(", ");
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
    `${String(report.derivedSingulars)} derived singulars, ${String(report.exclusions.length)} excluded ` +
    `(${summarizeCounts(exclusionCounts)})`,
);

log.info(
    `enums: ${String(report.enumExclusions.length)} skipped ` +
    `(${summarizeEnumExclusions(report.enumExclusions)})`,
);

log.info(`core profile: ${String(report.coreRemovals.length)} symbols removed`);
