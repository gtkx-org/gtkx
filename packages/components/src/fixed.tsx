import type * as Gsk from "@gtkx/gi/gsk";
import type * as Gtk from "@gtkx/gi/gtk";
import { GtkFixed } from "@gtkx/jsx/gtk";
import { createPortal, rootElement } from "@gtkx/react";
import type { ElementType, ReactNode, Ref } from "react";
import { createContext, useRef } from "react";
import { useLatest } from "./internal/use-latest.js";
import {
    createPlacedContainer,
    type PlacedOps,
    type Placement,
    usePlacedChild,
    usePlacementContext,
} from "./internal/use-placement.js";
import type { FixedChildProps, FixedProps } from "./types.js";

type FixedPoint = {
    x: number;
    y: number;
    transform: Gsk.Transform | null;
};

const FixedContext = createContext<Placement<FixedPoint> | null>(null);

const fixedOps = (fixed: { current: Gtk.Fixed | null }): PlacedOps<FixedPoint> => ({
    attach: (widget, point) => {
        fixed.current?.put(widget, point.x, point.y);
        if (point.transform !== null) fixed.current?.setChildTransform(widget, point.transform);
    },
    update: (widget, point) => {
        fixed.current?.setChildTransform(widget, point.transform);
        if (point.transform === null) fixed.current?.move(widget, point.x, point.y);
    },
    detach: (widget) => {
        fixed.current?.remove(widget);
    },
});

type FixedChildRuntimeProps = {
    component: ElementType;
    x?: number | null | undefined;
    y?: number | null | undefined;
    transform?: Gsk.Transform | null | undefined;
    ref?: Ref<Gtk.Widget | null> | undefined;
} & Record<string, unknown>;

const useTransformSerial = (transform: Gsk.Transform | null): number => {
    const serial = useRef({ transform: null as Gsk.Transform | null, value: 0 });
    if (serial.current.transform !== transform) {
        serial.current = { transform, value: serial.current.value + 1 };
    }
    return serial.current.value;
};

const FixedChildImpl = (props: FixedChildRuntimeProps): ReactNode => {
    const placement = usePlacementContext(FixedContext, "<Fixed.Child> must be a child of <Fixed>");
    const { component: Component, x, y, transform, ref, ...rest } = props;
    const point = useLatest<FixedPoint>({ x: x ?? 0, y: y ?? 0, transform: transform ?? null });
    const serial = useTransformSerial(point.current.transform);
    const refCallback = usePlacedChild(
        placement,
        ref,
        () => point.current,
        `${point.current.x}:${point.current.y}:${serial}`,
    );
    return createPortal(<Component {...rest} ref={refCallback} />, rootElement);
};

const FixedChild = FixedChildImpl as <C extends ElementType>(props: FixedChildProps<C>) => ReactNode;

const FixedRoot = createPlacedContainer<Gtk.Fixed, FixedPoint>({
    element: GtkFixed,
    context: FixedContext,
    ops: fixedOps,
}) as (props: FixedProps) => ReactNode;

type FixedComponent = ((props: FixedProps) => ReactNode) & {
    Child: <C extends ElementType>(props: FixedChildProps<C>) => ReactNode;
};

/** Renders a GtkFixed whose children are pinned at coordinates or transforms through {@link Fixed.Child}. */
export const Fixed: FixedComponent = Object.assign(FixedRoot, { Child: FixedChild });
