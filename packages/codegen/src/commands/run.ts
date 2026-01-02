/**
 * Run Command
 *
 * Unified code generation command that runs both FFI and React generation
 * in a single pass using the CodegenOrchestrator.
 *
 * This replaces the separate `ffi` and `react` commands.
 */

import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { defineCommand } from "citty";
import { CodegenOrchestrator } from "../core/codegen-orchestrator.js";
import { intro, log, outro, spinner } from "../core/utils/progress.js";
import { FFI_OUTPUT_DIR, GIRS_DIR, REACT_OUTPUT_DIR } from "./constants.js";

export const run = defineCommand({
    meta: {
        name: "run",
        description: "Run code generation (FFI and React bindings)",
    },
    run: async () => {
        intro("Running code generation");

        if (!existsSync(GIRS_DIR)) {
            log.error(`GIR directory not found: ${GIRS_DIR}`);
            log.info("Run 'gtkx-codegen sync' first to sync GIR files from system");
            process.exit(1);
        }

        const orchestrator = new CodegenOrchestrator({
            girsDir: GIRS_DIR,
            ffiOutputDir: FFI_OUTPUT_DIR,
            reactOutputDir: REACT_OUTPUT_DIR,
        });

        const genSpinner = spinner("Generating bindings");

        const result = await orchestrator.generate();

        genSpinner.stop(`Generated ${result.stats.widgets} widgets from ${result.stats.namespaces} namespaces`);

        const ffiSpinner = spinner("Writing FFI files");

        if (existsSync(FFI_OUTPUT_DIR)) {
            rmSync(FFI_OUTPUT_DIR, { recursive: true, force: true });
        }
        mkdirSync(FFI_OUTPUT_DIR, { recursive: true });

        for (const [filePath, content] of result.ffiFiles) {
            const fullPath = join(FFI_OUTPUT_DIR, filePath);
            const dir = dirname(fullPath);
            if (!existsSync(dir)) {
                mkdirSync(dir, { recursive: true });
            }
            writeFileSync(fullPath, content);
        }

        ffiSpinner.stop(`Wrote ${result.ffiFiles.size} FFI files`);

        const reactSpinner = spinner("Writing React files");

        if (existsSync(REACT_OUTPUT_DIR)) {
            rmSync(REACT_OUTPUT_DIR, { recursive: true, force: true });
        }
        mkdirSync(REACT_OUTPUT_DIR, { recursive: true });

        for (const [filePath, content] of result.reactFiles) {
            writeFileSync(join(REACT_OUTPUT_DIR, filePath), content);
        }

        reactSpinner.stop(`Wrote ${result.reactFiles.size} React files`);

        log.success(`Completed in ${result.stats.duration}ms`);
        outro("Code generation complete");
    },
});
