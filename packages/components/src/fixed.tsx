import type * as Gsk from "@gtkx/gi/gsk";
import type * as Gtk from "@gtkx/gi/gtk";
import { GtkFixed } from "@gtkx/jsx/gtk";
import { createPortal, rootElement } from "@gtkx/react";
import type { ElementType, ReactNode, Ref } from "react";
import { createContext, useRef } from "react";
import {
    createPlacedRoot,
    type PlacedChildren,
    type PlacedOps,
    usePlacedChildEffects,
    useRequiredContext,
} from "./internal/placed-children.js";
import { useLatest } from "./internal/use-latest.js";
import { useWidgetRef } from "./internal/use-widget-ref.js";
import type { FixedChildProps, FixedProps } from "./types.js";

type FixedPlacement = {
    x: number;
    y: number;
    transform: Gsk.Transform | null;
};

const FixedContext = createContext<PlacedChildren<FixedPlacement> | null>(null);

const fixedOps = (fixed: { current: Gtk.Fixed | null }): PlacedOps<FixedPlacement> => ({
    attach: (widget, placement) => {
        fixed.current?.put(widget, placement.x, placement.y);
        if (placement.transform !== null) fixed.current?.setChildTransform(widget, placement.transform);
    },
    update: (widget, placement) => {
        fixed.current?.setChildTransform(widget, placement.transform);
        if (placement.transform === null) fixed.current?.move(widget, placement.x, placement.y);
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
    const serialRef = useRef({ transform: null as Gsk.Transform | null, serial: 0 });
    if (serialRef.current.transform !== transform) {
        serialRef.current = { transform, serial: serialRef.current.serial + 1 };
    }
    return serialRef.current.serial;
};

const FixedChildImpl = (props: FixedChildRuntimeProps): ReactNode => {
    const controller = useRequiredContext(FixedContext, "<Fixed.Child> must be a child of <Fixed>");
    const { component: Component, x, y, transform, ref, ...rest } = props;
    const [widget, refCallback] = useWidgetRef<Gtk.Widget>(ref);
    const placement = useLatest<FixedPlacement>({ x: x ?? 0, y: y ?? 0, transform: transform ?? null });
    const transformSerial = useTransformSerial(placement.current.transform);
    usePlacedChildEffects(
        controller,
        widget,
        () => placement.current,
        `${placement.current.x}:${placement.current.y}:${transformSerial}`,
    );
    return createPortal(<Component {...rest} ref={refCallback} />, rootElement);
};

const FixedChild = FixedChildImpl as <C extends ElementType>(props: FixedChildProps<C>) => ReactNode;

const FixedRoot = createPlacedRoot<Gtk.Fixed, FixedPlacement>({
    element: GtkFixed,
    context: FixedContext,
    ops: fixedOps,
}) as (props: FixedProps) => ReactNode;

type FixedComponent = ((props: FixedProps) => ReactNode) & {
    Child: <C extends ElementType>(props: FixedChildProps<C>) => ReactNode;
};

/** Renders a GtkFixed whose children are pinned at coordinates or transforms through {@link Fixed.Child}. */
export const Fixed: FixedComponent = Object.assign(FixedRoot, { Child: FixedChild });
