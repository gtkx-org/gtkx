import type { RunCodegenResult } from "./run-codegen.js";

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
