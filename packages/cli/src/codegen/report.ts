import type { RunCodegenResult } from "./run-codegen.js";
import { REFERENCE_PATH } from "./reference.js";

const PREFIX = "codegen: ";

const contextDetails = (result: RunCodegenResult): string[] => {
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

    return details;
};

const referenceDetails = (result: RunCodegenResult): string[] => {
    if (result.reference?.isRegenerated !== true) {
        return [];
    }

    return [`${String(result.reference.elements)} reference pages in ${REFERENCE_PATH}`];
};

const formatCodegenResult = (result: RunCodegenResult, totalMs: number): string[] => {
    const details = [
        ...contextDetails(result),
        `${String(result.namespaces)} namespaces, ${String(result.intrinsicElements)} intrinsic elements ` +
        `in ${String(result.duration)}ms (total ${String(totalMs)}ms)`,
        ...referenceDetails(result),
    ];

    return details.map((detail) => PREFIX + detail);
};

export { formatCodegenResult };
