import "./bootstrap.js";

/** @internal */
export { createApplicationComponent } from "./components/application.js";
export { createElementComponent } from "./components/element.js";
/** @internal */
export { createWindowComponent } from "./components/window.js";
export { useMergedRef } from "./hooks/use-merged-refs.js";
export type * from "./prop-types.js";
export type { ModuleExport } from "./reconciler/registry.js";
export { isRootElement } from "./reconciler/root-element.js";
export { createReconcilerRoot, type ReconcilerRoot, setReconcilerErrorHandler } from "./reconciler/root.js";
export { applyWrite } from "./reconciler/signals.js";
export { getAccessibleMetadata } from "./utils/accessible-metadata.js";
export type { SettingsSchema, SettingsSchemaKeys, SettingValue } from "./utils/settings.js";
