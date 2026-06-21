import * as Gtk from "@gtkx/gi/gtk";
import {
    createElement,
    type ReactNode,
    type Ref,
    useContext,
    useEffect,
    useLayoutEffect,
    useMemo,
    useReducer,
    useRef,
    useState,
} from "react";
import { useForwardedRef } from "../hooks/use-forwarded-ref.js";
import { onOrderedAttach } from "../reconciler/attach-events.js";
import type { BoundItem } from "../reconciler/bound-item.js";
import { createPortal } from "../reconciler/portal.js";
import { createElementComponent } from "../utils/create-element-component.js";
import type {
    ColumnViewColumnProps,
    ColumnViewProps,
    DropDownProps,
    GridViewProps,
    ListViewProps,
} from "../utils/element-props.js";
import { type DropDownLike, isAdwComboRow } from "../utils/gtype-predicates.js";
import { ColumnController } from "./column-controller.js";
import { ColumnViewContext } from "./column-view-context.js";
import { ListController, type ListControllerProps } from "./list-controller.js";

const GtkListViewElement = createElementComponent<Record<string, unknown>>("GtkListView");
const GtkGridViewElement = createElementComponent<Record<string, unknown>>("GtkGridView");
const GtkColumnViewElement = createElementComponent<Record<string, unknown>>("GtkColumnView");
const GtkColumnViewColumnElement = createElementComponent<Record<string, unknown>>("GtkColumnViewColumn");
const GtkDropDownElement = createElementComponent<Record<string, unknown>>("GtkDropDown");
const AdwComboRowElement = createElementComponent<Record<string, unknown>>("AdwComboRow");

const resolveDropDownWidget = (widget: Gtk.Widget): DropDownLike | null =>
    widget instanceof Gtk.DropDown ? widget : null;
const resolveComboRow = (widget: Gtk.Widget): DropDownLike | null => (isAdwComboRow(widget) ? widget : null);

const CONTROLLER_KEYS = [
    "items",
    "model",
    "renderItem",
    "renderListItem",
    "renderHeader",
    "autoexpand",
    "selected",
    "selectionMode",
    "selectedId",
    "sortColumn",
    "sortOrder",
    "onSortChanged",
    "estimatedItemHeight",
    "estimatedItemWidth",
    "estimatedRowHeight",
] as const;

const CONTROLLER_KEY_SET = new Set<string>(CONTROLLER_KEYS);

const SELECTION_CHANGED_KEY = "onSelectionChanged";

type SplitProps = { controllerProps: ListControllerProps; elementProps: Record<string, unknown> };

const resolveSelectionCallback = (value: unknown, isDropDown: boolean): Partial<ListControllerProps> => {
    if (typeof value !== "function") return {};
    return isDropDown
        ? { onDropDownSelectionChanged: value as (id: string) => void }
        : { onMultiSelectionChanged: value as (ids: string[]) => void };
};

const splitProps = (props: Record<string, unknown>, isDropDown: boolean): SplitProps => {
    const controllerProps: Record<string, unknown> = {};
    const elementProps: Record<string, unknown> = {};
    for (const key of Object.keys(props)) {
        if (key === SELECTION_CHANGED_KEY) continue;
        if (CONTROLLER_KEY_SET.has(key)) controllerProps[key] = props[key];
        else elementProps[key] = props[key];
    }
    return {
        controllerProps: {
            ...(controllerProps as ListControllerProps),
            ...resolveSelectionCallback(props[SELECTION_CHANGED_KEY], isDropDown),
        },
        elementProps,
    };
};

interface ListHandle {
    setWidget: (widget: Gtk.Widget | null) => void;
    widget: Gtk.Widget | null;
    controller: ListController | null;
    rerender: () => void;
    controllerProps: ListControllerProps;
}

const useListController = (
    controllerProps: ListControllerProps,
    resolveDropDown?: (widget: Gtk.Widget) => DropDownLike | null,
): ListHandle => {
    const [widget, setWidget] = useState<Gtk.Widget | null>(null);
    const [, rerender] = useReducer((x: number) => x + 1, 0);
    const controllerRef = useRef<ListController | null>(null);
    const prevPropsRef = useRef<ListControllerProps>(controllerProps);
    const appliedFirstUpdate = useRef(false);

    if (widget && !controllerRef.current) {
        controllerRef.current = new ListController(
            widget,
            resolveDropDown?.(widget) ?? null,
            controllerProps,
            rerender,
        );
        prevPropsRef.current = controllerProps;
        appliedFirstUpdate.current = false;
    }

    useLayoutEffect(() => {
        const controller = controllerRef.current;
        if (!controller) return;
        controller.attach();
        return () => {
            controller.dispose();
            controllerRef.current = null;
        };
    }, [widget]);

    const controller = controllerRef.current;
    useEffect(() => {
        if (!controller) return;
        if (!appliedFirstUpdate.current) {
            appliedFirstUpdate.current = true;
            prevPropsRef.current = controllerProps;
            return;
        }
        controller.update(prevPropsRef.current, controllerProps);
        prevPropsRef.current = controllerProps;
    });

    return { setWidget, widget, controller, rerender, controllerProps };
};

const EMPTY_BOUND_ITEMS: BoundItem[] = [];

const renderPortals = (boundItems: BoundItem[], headerBoundItems: BoundItem[]): ReactNode[] => {
    const portals: ReactNode[] = [];
    for (const [content, container, key] of [...boundItems, ...headerBoundItems]) {
        portals.push(createPortal(content, container, key));
    }
    return portals;
};

type ListElementOptions = {
    scope?: (handle: ListHandle) => ReactNode;
    resolveDropDown?: (widget: Gtk.Widget) => DropDownLike | null;
};

const useListElement = (
    elementType: (props: Record<string, unknown>) => ReactNode,
    props: Record<string, unknown> & { ref?: Ref<Gtk.Widget>; children?: ReactNode },
    options?: ListElementOptions,
): { node: ReactNode; handle: ListHandle } => {
    const { ref, children, ...rest } = props;
    const { controllerProps, elementProps } = splitProps(rest, options?.resolveDropDown !== undefined);
    const handle = useListController(controllerProps, options?.resolveDropDown);
    const [, mergedRef] = useForwardedRef<Gtk.Widget>(ref, handle.setWidget);
    const boundItems = handle.controller?.getBoundItems() ?? EMPTY_BOUND_ITEMS;
    const headerBoundItems = handle.controller?.getHeaderBoundItems() ?? EMPTY_BOUND_ITEMS;
    const portals = useMemo(() => renderPortals(boundItems, headerBoundItems), [boundItems, headerBoundItems]);
    const scopedChildren = options?.scope ? options.scope(handle) : children;
    const node = (
        <>
            {createElement(elementType, { ...elementProps, ref: mergedRef }, scopedChildren)}
            {portals}
        </>
    );
    return { node, handle };
};

export function GtkListView<T = unknown, S = unknown>(
    props: ListViewProps<T, S> & { children?: ReactNode; ref?: Ref<Gtk.ListView> },
): ReactNode {
    return useListElement(GtkListViewElement, props as Record<string, unknown> & { ref?: Ref<Gtk.Widget> }).node;
}

export function GtkGridView<T = unknown>(
    props: GridViewProps<T> & { children?: ReactNode; ref?: Ref<Gtk.GridView> },
): ReactNode {
    return useListElement(GtkGridViewElement, props as Record<string, unknown> & { ref?: Ref<Gtk.Widget> }).node;
}

export function GtkDropDown<T = unknown, S = unknown>(
    props: DropDownProps<T, S> & { children?: ReactNode; ref?: Ref<Gtk.DropDown> },
): ReactNode {
    return useListElement(GtkDropDownElement, props as Record<string, unknown> & { ref?: Ref<Gtk.Widget> }, {
        resolveDropDown: resolveDropDownWidget,
    }).node;
}

export function AdwComboRow<T = unknown, S = unknown>(
    props: DropDownProps<T, S> & { children?: ReactNode; ref?: Ref<Gtk.Widget> },
): ReactNode {
    return useListElement(AdwComboRowElement, props as Record<string, unknown> & { ref?: Ref<Gtk.Widget> }, {
        resolveDropDown: resolveComboRow,
    }).node;
}

function GtkColumnViewBase<T = unknown, S = unknown>(
    props: ColumnViewProps<T, S> & { children?: ReactNode; ref?: Ref<Gtk.ColumnView> },
): ReactNode {
    const { children, ...rest } = props as Record<string, unknown> & { children?: ReactNode };
    const { node, handle } = useListElement(
        GtkColumnViewElement,
        rest as Record<string, unknown> & { ref?: Ref<Gtk.Widget> },
        {
            scope: (live) => (
                <ColumnViewContext.Provider value={live.controller}>{children}</ColumnViewContext.Provider>
            ),
        },
    );
    const controller = handle.controller;
    const widget = handle.widget;
    useLayoutEffect(() => {
        if (!controller || !(widget instanceof Gtk.ColumnView)) return;
        return onOrderedAttach(widget, () => controller.scheduleColumnSettle());
    }, [controller, widget]);
    return node;
}

export const GtkColumnView: typeof GtkColumnViewBase = GtkColumnViewBase;

export const GtkColumnViewColumn: <T = unknown>(props: ColumnViewColumnProps<T>) => ReactNode = ColumnViewColumn;

function ColumnViewColumn<T = unknown>({ renderCell, sortable, ...rest }: ColumnViewColumnProps<T>): ReactNode {
    const list = useContext(ColumnViewContext);
    const controllerRef = useRef<ColumnController | null>(null);
    controllerRef.current ??= new ColumnController();
    const controller = controllerRef.current;
    const sorterRef = useRef<Gtk.CustomSorter | null>(null);
    if (sortable === true && sorterRef.current === null) sorterRef.current = new Gtk.CustomSorter();

    useLayoutEffect(() => {
        if (!list) return;
        controller.register(list);
        return () => controller.unregister();
    }, [list, controller]);

    useLayoutEffect(() => {
        controller.setRenderCell((renderCell as ((item: unknown) => ReactNode) | undefined) ?? null);
    });

    useEffect(() => () => controller.teardown(), [controller]);

    return createElement(GtkColumnViewColumnElement, {
        ...rest,
        factory: controller.factory,
        sorter: sortable === true ? sorterRef.current : null,
    });
}
