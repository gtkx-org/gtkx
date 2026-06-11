import type * as Gtk from "@gtkx/gi/gtk";
import type { GtkDrawingAreaProps } from "@gtkx/jsx/gtk";
import { type ReactNode, useLayoutEffect, useRef } from "react";
import { createWidgetComponent } from "../create-widget-component.js";
import { useMergedRefs } from "../use-merged-refs.js";

const GtkDrawingAreaElement = createWidgetComponent<Omit<GtkDrawingAreaProps, "render">>("GtkDrawingArea");

/**
 * Declarative wrapper for `Gtk.DrawingArea`.
 *
 * The `render` callback draws the area's content; it receives the Cairo context,
 * the current width and height, and the backing `Gtk.DrawingArea`. A draw
 * function is installed on the widget while `render` is present and removed when
 * it is absent; changing the `render` reference queues a redraw so the new
 * callback runs on the next frame. All other props (size, visibility, children,
 * event controllers, …) forward to the underlying widget.
 *
 * @example
 * ```tsx
 * <GtkDrawingArea
 *   contentWidth={200}
 *   contentHeight={100}
 *   render={(cr, width, height) => {
 *     cr.setSourceRgb(1, 0, 0);
 *     cr.rectangle(0, 0, width, height);
 *     cr.fill();
 *   }}
 * />
 * ```
 *
 * @param props - {@link GtkDrawingAreaProps}, including the `render` callback.
 */
export const GtkDrawingArea = ({ render, ref, children, ...rest }: GtkDrawingAreaProps): ReactNode => {
    const areaRef = useRef<Gtk.DrawingArea | null>(null);
    const renderRef = useRef(render);
    renderRef.current = render;
    const mergedRef = useMergedRefs(areaRef, ref);

    useLayoutEffect(() => {
        const area = areaRef.current;
        if (!area) return;
        if (!render) {
            area.setDrawFunc(null);
            return;
        }
        area.setDrawFunc((self, cr, width, height) => renderRef.current?.(cr, width, height, self));
        area.queueDraw();
        return () => area.setDrawFunc(null);
    }, [render]);

    return (
        <GtkDrawingAreaElement ref={mergedRef} {...rest}>
            {children}
        </GtkDrawingAreaElement>
    );
};
