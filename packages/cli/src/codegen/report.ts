import type { RunCodegenResult } from "./run-codegen.js";

const PREFIX = "codegen: ";

export const formatCodegenResult = (result: RunCodegenResult, totalMs: number): string[] => {
    const details: string[] = [];
    if (result.configFile) {
        details.push(`config=${result.configFile}`);
    }
    if (result.libraries) {
        details.push(`libraries=${result.libraries.join(", ")}`);
    }
    if (result.girPath) {
        details.push(`girPath=${result.girPath.join(":")}`);
    }
    details.push(
        `${result.namespaces} namespaces, ${result.intrinsicElements} intrinsic elements in ${result.duration}ms (total ${totalMs}ms)`,
    );
    return details.map((detail) => PREFIX + detail);
};
