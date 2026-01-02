/**
 * Async method analysis utilities.
 *
 * Provides analysis of async/finish method pairs in GIR data.
 */

import type { NormalizedMethod } from "@gtkx/gir";

/**
 * Result of async method analysis.
 */
export type AsyncMethodAnalysis = {
    /** Methods that are async (have Gio.AsyncReadyCallback parameter) */
    asyncMethods: Set<string>;
    /** Methods that are finish methods (called by async wrappers) */
    finishMethods: Set<string>;
    /** Mapping from async method name to its finish method name */
    asyncPairs: Map<string, string>;
};

/**
 * Analyzes methods for async/finish pairs.
 *
 * Uses the `finishFunc` attribute from GIR to identify async/finish pairs.
 * Methods without explicit `finishFunc` attribute are not paired.
 *
 * @param methods - The methods to analyze
 * @returns Analysis result with async/finish method sets and pairs
 *
 * @example
 * ```typescript
 * const analysis = analyzeAsyncMethods(cls.methods);
 * for (const [asyncMethod, finishMethod] of analysis.asyncPairs) {
 *   console.log(`${asyncMethod} -> ${finishMethod}`);
 * }
 * ```
 */
export const analyzeAsyncMethods = (methods: readonly NormalizedMethod[]): AsyncMethodAnalysis => {
    const asyncMethods = new Set<string>();
    const finishMethods = new Set<string>();
    const asyncPairs = new Map<string, string>();

    const methodNames = new Set(methods.map((m) => m.name));

    for (const method of methods) {
        if (method.finishFunc && methodNames.has(method.finishFunc)) {
            asyncMethods.add(method.name);
            finishMethods.add(method.finishFunc);
            asyncPairs.set(method.name, method.finishFunc);
        }
    }

    return { asyncMethods, finishMethods, asyncPairs };
};
