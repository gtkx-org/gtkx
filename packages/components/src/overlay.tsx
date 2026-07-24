import type * as Gtk from "@gtkx/gi/gtk";
import { GtkOverlay } from "@gtkx/jsx/gtk";
import { createPortal, rootElement } from "@gtkx/react";
import type { ElementType, ReactNode, Ref } from "react";
import { createContext } from "react";
import { useLatest } from "./internal/use-latest.js";
import {
    createPlacedContainer,
    type PlacedOps,
    type Placement,
    usePlacedChild,
    usePlacementContext,
} from "./internal/use-placement.js";
import type { OverlayChildProps, OverlayProps } from "./types.js";

type OverlayFlags = {
    measure: boolean;
    clipOverlay: boolean;
};

const OverlayContext = createContext<Placement<OverlayFlags> | null>(null);

const overlayOps = (overlay: { current: Gtk.Overlay | null }): PlacedOps<OverlayFlags> => {
    const applyFlags = (widget: Gtk.Widget, flags: OverlayFlags): void => {
        overlay.current?.setMeasureOverlay(widget, flags.measure);
        overlay.current?.setClipOverlay(widget, flags.clipOverlay);
    };
    return {
        attach: (widget, flags) => {
            overlay.current?.addOverlay(widget);
            applyFlags(widget, flags);
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
    const placement = usePlacementContext(OverlayContext, "<Overlay.Child> must be a child of <Overlay>");
    const { component: Component, measure, clipOverlay, ref, ...rest } = props;
    const flags = useLatest<OverlayFlags>({ measure: measure ?? false, clipOverlay: clipOverlay ?? false });
    const refCallback = usePlacedChild(
        placement,
        ref,
        () => flags.current,
        `${flags.current.measure}:${flags.current.clipOverlay}`,
    );
    return createPortal(<Component {...rest} ref={refCallback} />, rootElement);
};

const OverlayChild = OverlayChildImpl as <C extends ElementType>(props: OverlayChildProps<C>) => ReactNode;

const OverlayRoot = createPlacedContainer<Gtk.Overlay, OverlayFlags>({
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
