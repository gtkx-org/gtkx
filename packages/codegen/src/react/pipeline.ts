import type { GirRepository } from "../gir/repository.js";
import { generateCompounds } from "./compounds.js";
import { generateInternal } from "./internal.js";
import { generateJsx } from "./jsx.js";
import { mergeContainerSlots, mergeWidgetSlots } from "./slots.js";

/**
 * User-supplied slot overrides from `gtkx.config.ts`, keyed by JSX element
 * name with camelCase string values.
 */
export type UserSlots = {
    /** Widget-typed properties to surface as setter-semantics `ReactNode` slots. */
    readonly widgetSlots?: Readonly<Record<string, readonly string[]>>;
    /** Container methods to surface as append-semantics `ReactNode` slots. */
    readonly containerSlots?: Readonly<Record<string, readonly string[]>>;
};

/**
 * Produces the three React generated files (`jsx.ts`, `internal.ts`,
 * `compounds.tsx`) plus a summary widget count for the runner result.
 *
 * @param repository - The loaded GIR repository
 * @param userSlots - Widget- and container-slot overrides from `gtkx.config.ts`
 */
export const generateReactFiles = (
    repository: GirRepository,
    userSlots: UserSlots = {},
): { readonly files: Map<string, string>; readonly widgetCount: number } => {
    const widgetSlotMap = mergeWidgetSlots(userSlots.widgetSlots);
    const containerSlotMap = mergeContainerSlots(userSlots.containerSlots);
    const compounds = generateCompounds(repository, widgetSlotMap, containerSlotMap);
    const jsx = generateJsx(repository, compounds.exportedNames, widgetSlotMap, containerSlotMap);
    const internal = generateInternal(repository);
    const files = new Map<string, string>([
        ["jsx.ts", jsx],
        ["internal.ts", internal],
        ["compounds.tsx", compounds.source],
    ]);
    const widgetCount = jsx.split("\n").filter((line) => line.startsWith("export const ")).length;
    return { files, widgetCount };
};
