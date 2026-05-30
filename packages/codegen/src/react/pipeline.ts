import type { GirRepository } from "../gir/repository.js";
import { generateCompounds } from "./compounds.js";
import { generateInternal } from "./internal.js";
import { generateJsx } from "./jsx.js";
import { mergeSlotProps } from "./slot-props.js";

/**
 * Produces the three React generated files (`jsx.ts`, `internal.ts`,
 * `compounds.tsx`) plus a summary widget count for the runner result.
 *
 * @param repository - The loaded GIR repository
 * @param userSlotProps - Slot-prop overrides from `gtkx.config.ts`
 */
export const generateReactFiles = (
    repository: GirRepository,
    userSlotProps: Readonly<Record<string, readonly string[]>> | undefined,
): { readonly files: Map<string, string>; readonly widgetCount: number } => {
    const slotPropMap = mergeSlotProps(userSlotProps);
    const compounds = generateCompounds(repository, userSlotProps);
    const jsx = generateJsx(repository, compounds.exportedNames, slotPropMap);
    const internal = generateInternal(repository);
    const files = new Map<string, string>([
        ["jsx.ts", jsx],
        ["internal.ts", internal],
        ["compounds.tsx", compounds.source],
    ]);
    const widgetCount = jsx.split("\n").filter((line) => line.startsWith("export const ")).length;
    return { files, widgetCount };
};
