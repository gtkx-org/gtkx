import type * as Gtk from "@gtkx/gi/gtk";
import { GtkOverlay, type GtkOverlayProps } from "@gtkx/jsx/gtk";
import { useMergedRef } from "@gtkx/react/internal";
import { Children, type ElementType, isValidElement, type ReactNode, type Ref, useRef } from "react";
import { createParentContext, usePlacedChild } from "./hooks/use-placed-child.js";
import type { ChildProps } from "./types.js";

const { Context: OverlayContext, useParentRef: useOverlayRef } = createParentContext<Gtk.Overlay>(
    "<Overlay.Child> must be a child of <Overlay>",
);

/** Props for {@link Overlay}. */
export type OverlayProps = GtkOverlayProps & { ref?: Ref<Gtk.Overlay | null> };

export type OverlayPlacementProps = {
    /** Whether this overlay contributes to the Overlay's measured size. */
    measure?: boolean | null | undefined;
    /** Whether the overlay is clipped to the main child's allocation. */
    clipOverlay?: boolean | null | undefined;
};

/** Adds a single widget as an overlay on top of an {@link Overlay}'s main child. */
export type OverlayChildProps<C extends ElementType> = ChildProps<C, OverlayPlacementProps>;

type OverlayPlacement = { measure: boolean; clipOverlay: boolean };

const placementOf = (props: OverlayPlacementProps): OverlayPlacement => ({
    measure: props.measure ?? false,
    clipOverlay: props.clipOverlay ?? false,
});

const samePlacement = (a: OverlayPlacement, b: OverlayPlacement): boolean =>
    a.measure === b.measure && a.clipOverlay === b.clipOverlay;

const OverlayChild = <C extends ElementType>({
    component,
    measure,
    clipOverlay,
    ref,
    ...rest
}: OverlayChildProps<C>): ReactNode => {
    const overlayRef = useOverlayRef();
    const Component: ElementType = component;
    return usePlacedChild<Gtk.Widget, OverlayPlacement>({
        render: (placeRef) => <Component {...rest} ref={placeRef} />,
        ref,
        placement: placementOf({ measure, clipOverlay }),
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
export const Overlay: ((props: OverlayProps) => ReactNode) & {
    Child: <C extends ElementType>(props: OverlayChildProps<C>) => ReactNode;
} = Object.assign(
    ({ children, ref, ...rest }: OverlayProps): ReactNode => {
        const overlayRef = useRef<Gtk.Overlay | null>(null);
        const mergedRef = useMergedRef<Gtk.Overlay>(ref, overlayRef);
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
