/**
 * Renders React elements as GTK widgets: render roots, portals, and hooks for the application, windows,
 * GObject properties, signals and GSettings.
 *
 * @packageDocumentation
 */
import "./bootstrap.js";

export { createElementComponent } from "./components/element.js";
export { useApplication } from "./hooks/use-application.js";
export { useBindSetting } from "./hooks/use-bind-setting.js";
export { useParentWindow } from "./hooks/use-parent-window.js";
export { useProperty } from "./hooks/use-property.js";
export { useSetting } from "./hooks/use-setting.js";
export { useSignal } from "./hooks/use-signal.js";
export { type RootElement, rootElement } from "./reconciler/root-element.js";
export {
    type CaughtErrorInfo,
    createPortal,
    createRoot,
    quit,
    type Root,
    type RootOptions,
} from "./reconciler/root.js";
export type { AccessibleProps } from "./utils/accessible-props.js";
export type { SettingsSchema } from "./utils/settings.js";
