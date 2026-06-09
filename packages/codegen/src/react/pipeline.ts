import type { GirRepository } from "../gir/repository.js";
import { generateCompounds } from "./compounds.js";
import { generateInternal } from "./internal.js";
import { generateJsx } from "./jsx.js";
import { generatePresence } from "./presence.js";
import { mergeArrayProps, mergeContainerSlots, mergeWidgetSlots } from "./slots.js";
import { collectReactNodeClasses } from "./widgets.js";

/**
 * User-supplied slot overrides from `gtkx.config.ts`, keyed by JSX element
 * name with camelCase string values.
 */
export type UserSlots = {
    /** Widget-typed properties to surface as setter-semantics `ReactNode` slots. */
    readonly widgetSlots?: Readonly<Record<string, readonly string[]>>;
    /** Container methods to surface as append-semantics `ReactNode` slots. */
    readonly containerSlots?: Readonly<Record<string, readonly string[]>>;
    /** Array-valued props keyed by JSX element name then camelCase prop name to item-type name. */
    readonly arrayProps?: Readonly<Record<string, Readonly<Record<string, string>>>>;
};

/**
 * Produces the React generated files plus a summary widget count for the runner
 * result.
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
    const arrayPropMap = mergeArrayProps(userSlots.arrayProps);
    const compounds = generateCompounds(repository, widgetSlotMap, containerSlotMap);
    const jsx = generateJsx(repository, compounds.exportedNames, { widgetSlotMap, containerSlotMap, arrayPropMap });
    const internal = generateInternal(repository);
    const presence = generatePresence();
    const files = new Map<string, string>([
        ["jsx.ts", jsx],
        ["internal.ts", internal],
        ["compounds.tsx", compounds.source],
        ["presence.tsx", presence],
    ]);
    const widgetCount = collectReactNodeClasses(repository).length;
    return { files, widgetCount };
};
