import type * as Gtk from "@gtkx/gi/gtk";
import { GtkOverlay, type GtkOverlayProps } from "@gtkx/jsx/gtk";
import { useMergeRefs } from "@gtkx/react/internal";
import { Children, isValidElement, type ReactNode, type Ref, useRef } from "react";
import { createParentContext, type PlacedChildRender, usePlacedChild } from "./hooks/use-placed-child.js";

const { Context: OverlayContext, useParentRef: useOverlayRef } = createParentContext<Gtk.Overlay>(
    "<Overlay.Child> must be a child of <Overlay>",
);

/** Props for {@link Overlay}. */
export type OverlayProps = GtkOverlayProps & { ref?: Ref<Gtk.Overlay | null> };

/** Adds a single widget as an overlay on top of an {@link Overlay}'s main child. */
export type OverlayChildProps = {
    /** Render function receiving a ref callback to attach to the overlaid child widget. */
    children: PlacedChildRender<Gtk.Widget>;
    /** Whether this overlay contributes to the Overlay's measured size. */
    measure?: boolean | null | undefined;
    /** Whether the overlay is clipped to the main child's allocation. */
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
 * Renders a Gtk.Overlay: a main child with one or more widgets stacked on top,
 * declared via {@link Overlay.Child}. Non-Child children form the main content.
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
