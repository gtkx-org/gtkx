import type * as Gtk from "@gtkx/gi/gtk";
import { GtkOverlay } from "@gtkx/jsx/gtk";
import { createPortal, rootElement } from "@gtkx/react";
import type { ElementType, ReactNode, Ref } from "react";
import { createContext } from "react";
import {
    createPlacedRoot,
    type PlacedChildren,
    type PlacedOps,
    usePlacedChildEffects,
    useRequiredContext,
} from "./internal/placed-children.js";
import { useLatest } from "./internal/use-latest.js";
import { useWidgetRef } from "./internal/use-widget-ref.js";
import type { OverlayChildProps, OverlayProps } from "./types.js";

type OverlayPlacement = {
    measure: boolean;
    clipOverlay: boolean;
};

const OverlayContext = createContext<PlacedChildren<OverlayPlacement> | null>(null);

const overlayOps = (overlay: { current: Gtk.Overlay | null }): PlacedOps<OverlayPlacement> => {
    const applyFlags = (widget: Gtk.Widget, placement: OverlayPlacement): void => {
        overlay.current?.setMeasureOverlay(widget, placement.measure);
        overlay.current?.setClipOverlay(widget, placement.clipOverlay);
    };
    return {
        attach: (widget, placement) => {
            overlay.current?.addOverlay(widget);
            applyFlags(widget, placement);
        },
        update: applyFlags,
        detach: (widget) => {
            overlay.current?.removeOverlay(widget);
        },
    };
};

type OverlayChildRuntimeProps = {
    component: ElementType;
    measure?: boolean | null | undefined;
    clipOverlay?: boolean | null | undefined;
    ref?: Ref<Gtk.Widget | null> | undefined;
} & Record<string, unknown>;

const OverlayChildImpl = (props: OverlayChildRuntimeProps): ReactNode => {
    const controller = useRequiredContext(OverlayContext, "<Overlay.Child> must be a child of <Overlay>");
    const { component: Component, measure, clipOverlay, ref, ...rest } = props;
    const [widget, refCallback] = useWidgetRef<Gtk.Widget>(ref);
    const placement = useLatest<OverlayPlacement>({ measure: measure ?? false, clipOverlay: clipOverlay ?? false });
    usePlacedChildEffects(
        controller,
        widget,
        () => placement.current,
        `${placement.current.measure}:${placement.current.clipOverlay}`,
    );
    return createPortal(<Component {...rest} ref={refCallback} />, rootElement);
};

const OverlayChild = OverlayChildImpl as <C extends ElementType>(props: OverlayChildProps<C>) => ReactNode;

const OverlayRoot = createPlacedRoot<Gtk.Overlay, OverlayPlacement>({
    element: GtkOverlay,
    context: OverlayContext,
    ops: overlayOps,
}) as (props: OverlayProps) => ReactNode;

type OverlayComponent = ((props: OverlayProps) => ReactNode) & {
    Child: <C extends ElementType>(props: OverlayChildProps<C>) => ReactNode;
};

/**
 * Renders a Gtk.Overlay whose non-Child content forms the main child while
 * {@link Overlay.Child} entries stack on top with measure and clip placement.
 */
export const Overlay: OverlayComponent = Object.assign(OverlayRoot, { Child: OverlayChild });
