import type * as Gtk from "@gtkx/gi/gtk";
import type { Context, ElementType, ReactNode, Ref, RefCallback } from "react";
import { useContext, useLayoutEffect, useMemo, useRef } from "react";
import { applyRef, useWidgetRef } from "./use-widget-ref.js";

export type PlacedOps<P> = {
    attach: (widget: Gtk.Widget, placement: P) => void;
    update: (widget: Gtk.Widget, placement: P) => void;
    detach: (widget: Gtk.Widget) => void;
};

export type Placement<P> = {
    open: () => void;
    close: () => void;
    add: (widget: Gtk.Widget, placement: () => P) => void;
    remove: (widget: Gtk.Widget) => void;
    refresh: (widget: Gtk.Widget) => void;
    reportOrder: (widget: Gtk.Widget) => void;
    applyOrder: () => void;
};

type PlacementState<P> = {
    ops: PlacedOps<P>;
    placements: Map<Gtk.Widget, () => P>;
    attached: Set<Gtk.Widget>;
    reports: Gtk.Widget[];
    open: boolean;
};

const attachWidget = <P,>(state: PlacementState<P>, widget: Gtk.Widget): void => {
    const placement = state.placements.get(widget);
    if (placement === undefined) return;
    state.attached.add(widget);
    state.ops.attach(widget, placement());
};

const desiredOrder = <P,>(state: PlacementState<P>): Gtk.Widget[] | null => {
    const reported = state.reports;
    state.reports = [];
    if (!state.open) return null;
    const desired: Gtk.Widget[] = [];
    const seen = new Set<Gtk.Widget>();
    for (let index = reported.length - 1; index >= 0; index--) {
        const widget = reported[index];
        if (widget === undefined || seen.has(widget) || !state.attached.has(widget)) continue;
        seen.add(widget);
        desired.unshift(widget);
    }
    return desired.length === state.attached.size ? desired : null;
};

const applyOrder = <P,>(state: PlacementState<P>): void => {
    const desired = desiredOrder(state);
    if (desired === null) return;
    const current = [...state.attached];
    if (desired.every((widget, index) => current[index] === widget)) return;
    for (const widget of current) state.ops.detach(widget);
    state.attached.clear();
    for (const widget of desired) attachWidget(state, widget);
};

const createPlacement = <P,>(ops: PlacedOps<P>): Placement<P> => {
    const state: PlacementState<P> = {
        ops,
        placements: new Map(),
        attached: new Set(),
        reports: [],
        open: false,
    };
    return {
        open: () => {
            state.open = true;
            for (const widget of state.placements.keys()) attachWidget(state, widget);
        },
        close: () => {
            state.open = false;
            state.attached.clear();
        },
        add: (widget, placement) => {
            state.placements.set(widget, placement);
            if (state.open && !state.attached.has(widget)) attachWidget(state, widget);
        },
        remove: (widget) => {
            state.placements.delete(widget);
            if (state.attached.delete(widget) && state.open) ops.detach(widget);
        },
        refresh: (widget) => {
            const placement = state.placements.get(widget);
            if (placement === undefined || !state.open) return;
            if (state.attached.has(widget)) ops.update(widget, placement());
            else attachWidget(state, widget);
        },
        reportOrder: (widget) => {
            const previous = state.reports.indexOf(widget);
            if (previous !== -1) state.reports.splice(previous, 1);
            state.reports.push(widget);
        },
        applyOrder: () => applyOrder(state),
    };
};

export const usePlacementHost = <W, P>(
    widget: W | null,
    createOps: (host: { current: W | null }) => PlacedOps<P>,
): Placement<P> => {
    const host = useRef<W | null>(null);
    host.current = widget;
    const held = useRef<Placement<P> | null>(null);
    held.current ??= createPlacement(createOps(host));
    const placement = held.current;
    useLayoutEffect(() => {
        if (widget === null) return;
        placement.open();
        return () => placement.close();
    }, [widget, placement]);
    useLayoutEffect(() => {
        placement.applyOrder();
    });
    return placement;
};

export const usePlacementContext = <P,>(context: Context<Placement<P> | null>, message: string): Placement<P> => {
    const placement = useContext(context);
    if (placement === null) throw new Error(message);
    return placement;
};

export const usePlacedChild = <P,>(
    placement: Placement<P>,
    external: Ref<Gtk.Widget | null> | null | undefined,
    read: () => P,
    key: string,
): RefCallback<Gtk.Widget | null> => {
    const latest = useRef(read);
    latest.current = read;
    const widgetRef = useRef<Gtk.Widget | null>(null);
    const externalRef = useRef(external);
    const refCallback = useMemo<RefCallback<Gtk.Widget | null>>(
        () => (value) => {
            applyRef(externalRef.current, value);
            const previous = widgetRef.current;
            if (previous === value) return;
            widgetRef.current = value;
            if (previous !== null) placement.remove(previous);
            if (value !== null) placement.add(value, () => latest.current());
        },
        [placement],
    );
    useLayoutEffect(() => {
        if (externalRef.current === external) return;
        applyRef(externalRef.current, null);
        externalRef.current = external;
        if (widgetRef.current !== null) applyRef(external, widgetRef.current);
    });
    useLayoutEffect(() => {
        if (widgetRef.current !== null) placement.refresh(widgetRef.current);
    }, [placement, key]);
    useLayoutEffect(() => {
        if (widgetRef.current !== null) placement.reportOrder(widgetRef.current);
    });
    return refCallback;
};

type PlacedContainerConfig<W, P> = {
    element: ElementType;
    context: Context<Placement<P> | null>;
    ops: (host: { current: W | null }) => PlacedOps<P>;
};

type PlacedContainerProps<W> = {
    ref?: Ref<W | null> | undefined;
    children?: ReactNode | undefined;
} & Record<string, unknown>;

export const createPlacedContainer = <W, P>(
    config: PlacedContainerConfig<W, P>,
): ((props: PlacedContainerProps<W>) => ReactNode) => {
    const { element: Element, context: PlacementContext, ops } = config;
    return (props) => {
        const { ref, children, ...rest } = props;
        const [widget, refCallback] = useWidgetRef<W>(ref);
        const placement = usePlacementHost(widget, ops);
        return (
            <Element ref={refCallback} {...rest}>
                <PlacementContext.Provider value={placement}>{children}</PlacementContext.Provider>
            </Element>
        );
    };
};
