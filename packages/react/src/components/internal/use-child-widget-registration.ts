import type * as Gtk from "@gtkx/gi/gtk";
import { type ReactElement, type Ref, useLayoutEffect, useRef } from "react";
import { assignRef } from "../../use-merged-refs.js";

/** A single widget element whose `ref` the registration hook merges with its own. */
export type WidgetChild = ReactElement<{ ref?: Ref<Gtk.Widget> }>;

/**
 * Captures a marker child's backing widget through a callback ref (merged with
 * any ref the child already carries) and registers it from a layout effect
 * once it exists.
 *
 * Used by membership-style markers (`<GtkConstraintLayout.Widget>`) whose
 * single child must be enrolled with a registry keyed by its backing widget.
 *
 * @param child - The single widget element whose backing widget is captured.
 * @param register - Registers the captured widget and returns the cleanup that
 *   unregisters it; the effect re-runs when its identity changes.
 * @returns The callback ref to pass to the cloned child.
 */
export const useChildWidgetRegistration = (
    child: WidgetChild,
    register: (widget: Gtk.Widget) => () => void,
): ((widget: Gtk.Widget | null) => void) => {
    const widgetRef = useRef<Gtk.Widget | null>(null);
    const childRef = child.props.ref;

    const captureWidget = (widget: Gtk.Widget | null): void => {
        widgetRef.current = widget;
        assignRef(childRef, widget);
    };

    useLayoutEffect(() => {
        const widget = widgetRef.current;
        if (!widget) return;
        return register(widget);
    }, [register]);

    return captureWidget;
};
