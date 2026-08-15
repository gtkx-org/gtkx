import type { RunCodegenResult } from "./run-codegen.js";

const PREFIX = "codegen: ";

const formatCodegenResult = (result: RunCodegenResult, totalMs: number): string[] => {
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

    if (result.future && result.future.length > 0) {
        details.push(`future=${result.future.join(", ")}`);
    }

    details.push(
        `${String(result.namespaces)} namespaces, ${String(result.intrinsicElements)} intrinsic elements ` +
        `in ${String(result.duration)}ms (total ${String(totalMs)}ms)`,
    );

    return details.map((detail) => PREFIX + detail);
};

export { formatCodegenResult };
