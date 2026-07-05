import * as GObject from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkOverlay, type GtkOverlayProps } from "@gtkx/jsx/gtk";
import { createPortal, useMergeRefs } from "@gtkx/react";
import { stateOf } from "@gtkx/react/internal";
import {
    Children,
    type Context,
    createContext,
    isValidElement,
    type ReactNode,
    type Ref,
    type RefObject,
    useContext,
    useLayoutEffect,
    useRef,
} from "react";

const ORPHAN_MESSAGE = "<Overlay.Child> must be a child of <Overlay>";

const OverlayContext: Context<RefObject<Gtk.Overlay | null> | null> =
    createContext<RefObject<Gtk.Overlay | null> | null>(null);

const useOverlayRef = (): RefObject<Gtk.Overlay | null> => {
    const ref = useContext(OverlayContext);
    if (!ref) throw new Error(ORPHAN_MESSAGE);
    return ref;
};

const overlayWidgets = (holder: GObject.Object): Gtk.Widget[] => {
    const widgets: Gtk.Widget[] = [];
    for (const child of stateOf(holder).children) {
        if (child instanceof Gtk.Widget) widgets.push(child);
    }
    return widgets;
};

/**
 * Props for {@link Overlay}. Forwards every {@link Gtk.Overlay} widget prop; the
 * single non-`Overlay.Child` child becomes the overlay's main child, while each
 * {@link Overlay.Child} is stacked on top.
 */
export type OverlayProps = GtkOverlayProps & { ref?: Ref<Gtk.Overlay | null> };

/**
 * Props for {@link Overlay.Child}. Its widget children are placed over the
 * overlay's main child; `measure` includes them in size negotiation and
 * `clipOverlay` clips them to the main child's allocation.
 */
export type OverlayChildProps = {
    children?: ReactNode;
    measure?: boolean | null | undefined;
    clipOverlay?: boolean | null | undefined;
};

const OverlayChild = ({ children, measure, clipOverlay }: OverlayChildProps): ReactNode => {
    const overlayRef = useOverlayRef();
    const holderRef = useRef<GObject.Object | null>(null);
    if (holderRef.current === null) holderRef.current = new GObject.Object();
    const holder = holderRef.current;
    const trackedRef = useRef<Gtk.Widget[]>([]);

    useLayoutEffect(() => {
        const overlay = overlayRef.current;
        if (!overlay) return;
        const desired = overlayWidgets(holder);
        for (const widget of trackedRef.current) {
            if (!desired.includes(widget) && widget.getParent() === overlay) overlay.removeOverlay(widget);
        }
        for (const widget of desired) {
            if (widget.getParent() !== overlay) overlay.addOverlay(widget);
            overlay.setMeasureOverlay(widget, measure ?? false);
            overlay.setClipOverlay(widget, clipOverlay ?? false);
        }
        trackedRef.current = desired;
    });

    useLayoutEffect(
        () => () => {
            const overlay = overlayRef.current;
            for (const widget of trackedRef.current) {
                if (overlay && widget.getParent() === overlay) overlay.removeOverlay(widget);
            }
            trackedRef.current = [];
        },
        [],
    );

    return createPortal(children, holder, "overlay-child");
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
