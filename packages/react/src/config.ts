export { createElementComponent } from "./components/element.js";
export { BUILTIN_ELEMENTS } from "./element-config.js";
export type {
    DetachInfo,
    ElementBehavior,
    ElementConfig,
    ModuleExport,
    PlaceInfo,
    Props,
} from "./reconciler/registry.js";
export { defineBehavior, defineElements, ELEMENTS, mergeElementConfigs } from "./reconciler/registry.js";
