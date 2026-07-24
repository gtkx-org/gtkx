import * as Gtk from "@gtkx/gi/gtk";
import type { ElementType, ReactNode, Ref } from "react";
import { createContext, useImperativeHandle, useLayoutEffect, useRef } from "react";
import {
    type PlacedOps,
    type Placement,
    usePlacedChild,
    usePlacementContext,
    usePlacementHost,
} from "./internal/use-placement.js";
import type { SizeGroupChildProps, SizeGroupProps } from "./types.js";

const SizeGroupContext = createContext<Placement<null> | null>(null);

const sizeGroupOps = (group: { current: Gtk.SizeGroup | null }): PlacedOps<null> => ({
    attach: (widget) => {
        group.current?.addWidget(widget);
    },
    update: () => {},
    detach: (widget) => {
        group.current?.removeWidget(widget);
    },
});

type SizeGroupChildRuntimeProps = {
    component: ElementType;
    ref?: Ref<Gtk.Widget | null> | undefined;
} & Record<string, unknown>;

const SizeGroupChildImpl = (props: SizeGroupChildRuntimeProps): ReactNode => {
    const placement = usePlacementContext(SizeGroupContext, "<SizeGroup.Child> must be a child of <SizeGroup>");
    const { component: Component, ref, ...rest } = props;
    const refCallback = usePlacedChild(placement, ref, () => null, "");
    return <Component {...rest} ref={refCallback} />;
};

const SizeGroupChild = SizeGroupChildImpl as <C extends ElementType>(props: SizeGroupChildProps<C>) => ReactNode;

const SizeGroupRoot = (props: SizeGroupProps): ReactNode => {
    const { mode, ref, children } = props;
    const held = useRef<Gtk.SizeGroup | null>(null);
    held.current ??= new Gtk.SizeGroup({});
    const group = held.current;
    useImperativeHandle(ref, () => group, [group]);
    useLayoutEffect(() => {
        group.setMode(mode ?? Gtk.SizeGroupMode.HORIZONTAL);
    }, [group, mode]);
    const placement = usePlacementHost(group, sizeGroupOps);
    return <SizeGroupContext.Provider value={placement}>{children}</SizeGroupContext.Provider>;
};

type SizeGroupComponent = ((props: SizeGroupProps) => ReactNode) & {
    Child: <C extends ElementType>(props: SizeGroupChildProps<C>) => ReactNode;
};

/**
 * Creates a Gtk.SizeGroup that keeps widgets joined through {@link SizeGroup.Child}
 * at a common size in the given mode, without contributing a widget of its own.
 */
export const SizeGroup: SizeGroupComponent = Object.assign(SizeGroupRoot, { Child: SizeGroupChild });
