import type { RunCodegenResult } from "./run-codegen.js";

/**
 * Formats a {@link RunCodegenResult} into the `codegen:` summary lines printed
 * after a forced run, skipping the optional config/library/GIR-path fields when
 * absent. Returned without the `[gtkx]` prefix so the caller routes each line
 * through the shared logger.
 *
 * @param result - The codegen run summary.
 * @param totalMs - Wall-clock duration of the command, including presentation.
 * @returns The summary lines, in print order.
 */
export const formatCodegenResult = (result: RunCodegenResult, totalMs: number): string[] => {
    const lines: string[] = [];
    if (result.configFile) {
        lines.push(`codegen: config=${result.configFile}`);
    }
    if (result.libraries) {
        lines.push(`codegen: libraries=${result.libraries.join(", ")}`);
    }
    if (result.girPath) {
        lines.push(`codegen: girPath=${result.girPath.join(":")}`);
    }
    lines.push(
        `codegen: ${result.namespaces} namespaces, ${result.widgets} widgets in ${result.duration}ms (total ${totalMs}ms)`,
    );
    return lines;
};
