import type * as Gtk from "@gtkx/gi/gtk";
import { createElement, type ElementType, type ReactNode, useCallback } from "react";
import type {
    GtkCallbackActionElementProps,
    GtkShortcutTriggerElementProps,
} from "../prop-types.js";
import { useLatestRef } from "../hooks/use-latest-ref.js";

const createCallbackActionComponent = (Component: ElementType) =>
    ({ callback, ...props }: GtkCallbackActionElementProps): ReactNode => {
        const callbackRef = useLatestRef(callback);
        const handleShortcut = useCallback<Gtk.ShortcutFunc>(
            (widget, args) => callbackRef.current(widget, args),
            [callbackRef],
        );

        return createElement(Component, { ...props, callback: handleShortcut });
    };

const createShortcutTriggerComponent = (Component: ElementType) =>
    ({ accelerator, ...props }: GtkShortcutTriggerElementProps): ReactNode =>
        createElement(Component, { ...props, accelerator, key: accelerator });

export { createCallbackActionComponent, createShortcutTriggerComponent };
