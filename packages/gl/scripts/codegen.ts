import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { generateGlModules } from "@gtkx/codegen";
import { createLogger } from "@gtkx/utils";

const log = createLogger("gl");

const require = createRequire(import.meta.url);
const scriptDir = dirname(fileURLToPath(import.meta.url));
const registryPath = join(dirname(require.resolve("@gtkx/codegen/package.json")), "registry", "gl.xml");
const glSrcDir = join(scriptDir, "..", "src");
const outputDir = join(glSrcDir, "generated");

const EXPORT_PATTERN = /^export (?:async )?(?:function|const|type|interface|class) ([A-Za-z_$][\w$]*)/gm;

const companionExportNames = (path: string): Set<string> => {
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

log.info(`khronos codegen: ${report.selection.api} ${report.selection.version} ${report.selection.profile}`);

log.info(
    `commands: ${report.selectedCommands} selected, ${report.emittedCommands} emitted, ` +
        `${report.derivedSingulars} derived singulars, ${report.exclusions.length} excluded`,
);
