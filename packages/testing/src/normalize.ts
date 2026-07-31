import type { NormalizerFn, NormalizerOptions } from "./types.js";

/**
 * Builds the default text normalizer, which optionally trims surrounding whitespace and collapses
 * runs of whitespace into single spaces.
 * @param options Toggles for trimming and whitespace collapsing.
 * @returns A function that normalizes a string for comparison against a matcher.
 */
const getDefaultNormalizer = ({
    trim = true,
    collapseWhitespace = true,
}: NormalizerOptions = {}): NormalizerFn => {
    return (text: string): string => {
        let result = text;

        if (trim) {
            result = result.trim();
        }

        if (collapseWhitespace) {
            result = result.replaceAll(/\s+/g, " ");
        }

        return result;
    };
};

export { getDefaultNormalizer };
