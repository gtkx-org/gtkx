import "./utils/wrapper-node-jsx.js";

export type { ElementProp } from "@gtkx/config";
export { useApplication } from "./hooks/use-application.js";
export { useBindSetting } from "./hooks/use-bind-setting.js";
export { useParentWindow } from "./hooks/use-parent-window.js";
export { useProperty } from "./hooks/use-property.js";
export { type SchemaRef, useSetting } from "./hooks/use-setting.js";
export { useSignal } from "./hooks/use-signal.js";
export { useTickCallback } from "./hooks/use-tick-callback.js";
export type { AccessibleProps } from "./reconciler/accessible.js";
export { createPortal } from "./reconciler/portal.js";
export { setReconcilerErrorHandler } from "./reconciler/reconciler-error-handler.js";
export { createReconcilerRoot, type ReconcilerRoot } from "./reconciler/reconciler-root.js";
export { createRoot, quit, type Root } from "./reconciler/render.js";
export { type RootElement, rootElement } from "./reconciler/root-element.js";
export { getAccessibleMetadata } from "./utils/accessible-metadata.js";
export type { GObjectTarget } from "./utils/gobject-target.js";
export type { TextAnchorProps, TextPaintableProps } from "./utils/wrapper-node-jsx.js";
