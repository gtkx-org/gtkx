/**
 * Element registration and renderer behaviors, such as `defineElements` and `defineBehavior`.
 *
 * @packageDocumentation
 */
import { BUILTIN_ELEMENTS as BUILTIN_ELEMENT_METADATA } from "@gtkx/config/elements";
import type { ElementConfig } from "./reconciler/registry.js";

const BUILTIN_ELEMENTS: Record<string, ElementConfig> = BUILTIN_ELEMENT_METADATA;

export { BUILTIN_ELEMENTS };
export type {
    DetachInfo,
    ElementBehavior,
    ElementConfig,
    ElementPropsExport,
    ModuleExport,
    PlaceInfo,
    Props,
} from "./reconciler/registry.js";
export { defineBehavior, defineElements, ELEMENTS, mergeElementConfigs } from "./reconciler/registry.js";
