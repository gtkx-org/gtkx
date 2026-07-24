import type * as Gtk from "@gtkx/gi/gtk";
import {
    type Context,
    type ElementType,
    type ReactNode,
    type Ref,
    type RefCallback,
    useContext,
    useLayoutEffect,
    useMemo,
    useRef,
} from "react";
import { applyRef, useWidgetRef } from "./use-widget-ref.js";

export type PlacedOps<P> = {
    attach: (widget: Gtk.Widget, placement: P) => void;
    update: (widget: Gtk.Widget, placement: P) => void;
    detach: (widget: Gtk.Widget) => void;
};

export class PlacedChildren<P> {
    private ops: PlacedOps<P>;
    private ready = false;
    private entries = new Map<Gtk.Widget, () => P>();
    private attached = new Set<Gtk.Widget>();
    private orderReports: Gtk.Widget[] = [];

    constructor(ops: PlacedOps<P>) {
        this.ops = ops;
    }

    mount(): void {
        this.ready = true;
        for (const [widget, placement] of this.entries) {
            this.attached.add(widget);
            this.ops.attach(widget, placement());
        }
    }

    unmount(): void {
        this.ready = false;
        this.attached.clear();
    }

    add(widget: Gtk.Widget, placement: () => P): void {
        this.entries.set(widget, placement);
        if (this.ready && !this.attached.has(widget)) {
            this.attached.add(widget);
            this.ops.attach(widget, placement());
        }
    }

    refresh(widget: Gtk.Widget): void {
        const placement = this.entries.get(widget);
        if (placement === undefined || !this.ready) return;
        if (this.attached.has(widget)) {
            this.ops.update(widget, placement());
        } else {
            this.attached.add(widget);
            this.ops.attach(widget, placement());
        }
    }

    remove(widget: Gtk.Widget): void {
        this.entries.delete(widget);
        if (this.attached.delete(widget) && this.ready) this.ops.detach(widget);
    }

    reportOrder(widget: Gtk.Widget): void {
        const previous = this.orderReports.indexOf(widget);
        if (previous !== -1) this.orderReports.splice(previous, 1);
        this.orderReports.push(widget);
    }

    applyOrder(): void {
        const desired = this.consumeDesiredOrder();
        if (desired === null) return;
        const current = [...this.attached];
        if (desired.every((widget, index) => current[index] === widget)) return;
        for (const widget of current) this.ops.detach(widget);
        this.attached.clear();
        for (const widget of desired) {
            const placement = this.entries.get(widget);
            if (placement === undefined) continue;
            this.attached.add(widget);
            this.ops.attach(widget, placement());
        }
    }

    private consumeDesiredOrder(): Gtk.Widget[] | null {
        const reports = this.orderReports;
        this.orderReports = [];
        if (!this.ready) return null;
        const desired: Gtk.Widget[] = [];
        const seen = new Set<Gtk.Widget>();
        for (let index = reports.length - 1; index >= 0; index--) {
            const widget = reports[index];
            if (widget === undefined || seen.has(widget) || !this.attached.has(widget)) continue;
            seen.add(widget);
            desired.unshift(widget);
        }
        return desired.length === this.attached.size ? desired : null;
    }
}

export function usePlacedHost<W, P>(
    widget: W | null,
    createOps: (host: { current: W | null }) => PlacedOps<P>,
): PlacedChildren<P> {
    const hostRef = useRef<W | null>(null);
    hostRef.current = widget;
    const controllerRef = useRef<PlacedChildren<P> | null>(null);
    controllerRef.current ??= new PlacedChildren(createOps(hostRef));
    const controller = controllerRef.current;
    useLayoutEffect(() => {
        if (widget === null) return;
        controller.mount();
        return () => controller.unmount();
    }, [widget, controller]);
    useLayoutEffect(() => {
        controller.applyOrder();
    });
    return controller;
}

export function useRequiredContext<T>(context: Context<T | null>, message: string): T {
    const value = useContext(context);
    if (value === null) throw new Error(message);
    return value;
}

type PlacedRootConfig<W, P> = {
    element: ElementType;
    context: Context<PlacedChildren<P> | null>;
    ops: (host: { current: W | null }) => PlacedOps<P>;
};

type PlacedRootProps<W> = {
    ref?: Ref<W | null> | undefined;
    children?: ReactNode | undefined;
} & Record<string, unknown>;

export function createPlacedRoot<W, P>(config: PlacedRootConfig<W, P>): (props: PlacedRootProps<W>) => ReactNode {
    const { element: Element, context: PlacedContext, ops } = config;
    return (props) => {
        const { ref, children, ...rest } = props;
        const [widget, refCallback] = useWidgetRef<W>(ref);
        const controller = usePlacedHost(widget, ops);
        return (
            <Element ref={refCallback} {...rest}>
                <PlacedContext.Provider value={controller}>{children}</PlacedContext.Provider>
            </Element>
        );
    };
}

export function usePlacedChildRef<P>(
    controller: PlacedChildren<P>,
    external: Ref<Gtk.Widget | null> | null | undefined,
    placement: () => P,
    placementKey: string,
): RefCallback<Gtk.Widget | null> {
    const placementRef = useRef(placement);
    placementRef.current = placement;
    const widgetRef = useRef<Gtk.Widget | null>(null);
    const externalRef = useRef(external);
    const refCallback = useMemo<RefCallback<Gtk.Widget | null>>(
        () => (value) => {
            applyRef(externalRef.current, value);
            const previous = widgetRef.current;
            if (previous === value) return;
            widgetRef.current = value;
            if (previous !== null) controller.remove(previous);
            if (value !== null) controller.add(value, () => placementRef.current());
        },
        [controller],
    );
    useLayoutEffect(() => {
        if (externalRef.current === external) return;
        applyRef(externalRef.current, null);
        externalRef.current = external;
        if (widgetRef.current !== null) applyRef(external, widgetRef.current);
    });
    useLayoutEffect(() => {
        const widget = widgetRef.current;
        if (widget !== null) controller.refresh(widget);
    }, [controller, placementKey]);
    useLayoutEffect(() => {
        const widget = widgetRef.current;
        if (widget !== null) controller.reportOrder(widget);
    });
    return refCallback;
}
