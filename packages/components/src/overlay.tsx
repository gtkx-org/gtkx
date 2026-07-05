import type * as Gtk from "@gtkx/gi/gtk";
import { GtkOverlay, type GtkOverlayProps } from "@gtkx/jsx/gtk";
import { useMergeRefs } from "@gtkx/react";
import { Children, isValidElement, type ReactNode, type Ref, useRef } from "react";
import { createParentContext, type PlacedChildRender, usePlacedChild } from "./hooks/use-placed-child.js";

const { Context: OverlayContext, useParentRef: useOverlayRef } = createParentContext<Gtk.Overlay>(
    "<Overlay.Child> must be a child of <Overlay>",
);

/**
 * Props for {@link Overlay}. Forwards every {@link Gtk.Overlay} widget prop; the
 * single non-`Overlay.Child` child becomes the overlay's main child, while each
 * {@link Overlay.Child} is stacked on top.
 */
export type OverlayProps = GtkOverlayProps & { ref?: Ref<Gtk.Overlay | null> };

/**
 * Props for {@link Overlay.Child}. Its content, rendered through the child
 * function and wired to the passed ref, is placed over the overlay's main
 * child; `measure` includes it in size negotiation and `clipOverlay` clips it
 * to the main child's allocation.
 */
export type OverlayChildProps = {
    children: PlacedChildRender<Gtk.Widget>;
    measure?: boolean | null | undefined;
    clipOverlay?: boolean | null | undefined;
};

type OverlayPlacement = { measure: boolean; clipOverlay: boolean };

const placementOf = (props: OverlayChildProps): OverlayPlacement => ({
    measure: props.measure ?? false,
    clipOverlay: props.clipOverlay ?? false,
});

const samePlacement = (a: OverlayPlacement, b: OverlayPlacement): boolean =>
    a.measure === b.measure && a.clipOverlay === b.clipOverlay;

const OverlayChild = (props: OverlayChildProps): ReactNode => {
    const overlayRef = useOverlayRef();
    return usePlacedChild<Gtk.Widget, OverlayPlacement>({
        render: props.children,
        placement: placementOf(props),
        samePlacement,
        place: (widget, placement) => {
            const overlay = overlayRef.current;
            if (!overlay) return;
            if (widget.getParent() !== overlay) overlay.addOverlay(widget);
            overlay.setMeasureOverlay(widget, placement.measure);
            overlay.setClipOverlay(widget, placement.clipOverlay);
        },
        release: (widget) => {
            const overlay = overlayRef.current;
            if (overlay && widget.getParent() === overlay) overlay.removeOverlay(widget);
        },
    });
};

const isOverlayChild = (node: ReactNode): boolean => isValidElement(node) && node.type === OverlayChild;

/**
 * Declarative wrapper over {@link Gtk.Overlay}. The main child is a plain widget
 * child; overlays are declared with `<Overlay.Child>` and attached imperatively
 * through `gtk_overlay_add_overlay`.
 */
export const Overlay: ((props: OverlayProps) => ReactNode) & { Child: (props: OverlayChildProps) => ReactNode } =
    Object.assign(
        ({ children, ref, ...rest }: OverlayProps): ReactNode => {
            const overlayRef = useRef<Gtk.Overlay | null>(null);
            const mergedRef = useMergeRefs<Gtk.Overlay>(ref, overlayRef);
            const items = Children.toArray(children);
            const overlays = items.filter(isOverlayChild);
            const base = items.filter((node) => !isOverlayChild(node));
            return (
                <>
                    <GtkOverlay {...rest} ref={mergedRef}>
                        {base}
                    </GtkOverlay>
                    <OverlayContext.Provider value={overlayRef}>{overlays}</OverlayContext.Provider>
                </>
            );
        },
        { Child: OverlayChild },
    );
