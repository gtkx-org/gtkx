import "./utils/element-props.js";

export { withApplicationLifecycle, withApplicationWindowPresentation } from "./components/application.js";
export { withWindowPresentation } from "./components/top-level.js";
export { useApplication } from "./hooks/use-application.js";
export { useMergeRefs } from "./hooks/use-merge-refs.js";
export { useProperty } from "./hooks/use-property.js";
export { type SchemaRef, useSetting } from "./hooks/use-setting.js";
export { useSignal } from "./hooks/use-signal.js";
export { useTickCallback } from "./hooks/use-tick-callback.js";
export { createPortal } from "./reconciler/portal.js";
export { createRoot, quit, type Root } from "./reconciler/render.js";
export { createRootElement, type RootElement } from "./reconciler/root-element.js";
export { getAccessibleMetadata } from "./utils/accessible-metadata.js";
export { createElementComponent, createLazyElementComponent } from "./utils/create-element-component.js";
export type { TextAnchorProps, TextPaintableProps } from "./utils/element-props.js";
export type { GObjectTarget } from "./utils/gobject-target.js";
