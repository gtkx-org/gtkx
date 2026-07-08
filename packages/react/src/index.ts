import "./utils/element-props.js";

export { useApplication } from "./hooks/use-application.js";
export { useProperty } from "./hooks/use-property.js";
export { type SchemaRef, useSetting } from "./hooks/use-setting.js";
export { useSignal } from "./hooks/use-signal.js";
export { useTickCallback } from "./hooks/use-tick-callback.js";
export { createPortal } from "./reconciler/portal.js";
export { setReconcilerErrorHandler } from "./reconciler/reconciler-error-handler.js";
export { createReconcilerRoot, type ReconcilerRoot } from "./reconciler/reconciler-root.js";
export { createRoot, quit, type Root } from "./reconciler/render.js";
export { type RootElement, rootElement } from "./reconciler/root-element.js";
export { getAccessibleMetadata } from "./utils/accessible-metadata.js";
export type { ElementProp } from "@gtkx/config";
export type { TextAnchorProps, TextPaintableProps } from "./utils/element-props.js";
export type { GObjectTarget } from "./utils/gobject-target.js";
