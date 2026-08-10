/** @public */
export { createElementComponent } from "./components/element.js";
/** @public */
export { BUILTIN_ELEMENTS } from "./element-config.js";
/** @public */
export type {
    DetachInfo,
    ElementBehavior,
    ElementConfig,
    ModuleExport,
    PlaceInfo,
    Props,
} from "./reconciler/registry.js";
/** @public */
export { defineBehavior, defineElements, ELEMENTS, mergeElementConfigs } from "./reconciler/registry.js";
