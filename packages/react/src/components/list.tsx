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

/** The keys a list controller reads, used to split controller props from element props. */
const CONTROLLER_KEYS = [
    "items",
    "model",
    "renderItem",
    "renderListItem",
    "renderHeader",
    "autoexpand",
    "selected",
    "onSelectionChanged",
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

type SplitProps = { controllerProps: ListControllerProps; elementProps: Record<string, unknown> };

const splitProps = (props: Record<string, unknown>): SplitProps => {
    const controllerProps: Record<string, unknown> = {};
    const elementProps: Record<string, unknown> = {};
    for (const key of Object.keys(props)) {
        if (CONTROLLER_KEY_SET.has(key)) controllerProps[key] = props[key];
        else elementProps[key] = props[key];
    }
    return { controllerProps: controllerProps as ListControllerProps, elementProps };
};

/** The live list controller plus the portal re-render trigger, shared with column children. */
interface ListHandle {
    /** The widget setter passed to the element's merged ref. */
    readonly setWidget: (widget: Gtk.Widget | null) => void;
    /** The live controller once the widget has settled, else `null`. */
    readonly controller: ListController | null;
    /** Forces the component to re-render its portals. */
    readonly rerender: () => void;
    /** The latest controller props (read by the column view to apply sorting). */
    readonly controllerProps: ListControllerProps;
}

/**
 * Captures the list widget, drives a {@link ListController} through its lifecycle,
 * and re-renders portals whenever the controller's bound items change.
 *
 * @param controllerProps - The split controller props for the current render.
 * @returns The widget setter, the live controller, and the portal re-render trigger.
 */
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

    return { setWidget, controller, rerender, controllerProps };
};

/** Shared empty bound-item list so an unsettled controller yields a stable reference. */
const EMPTY_BOUND_ITEMS: BoundItem[] = [];

const renderPortals = (boundItems: BoundItem[], headerBoundItems: BoundItem[]): ReactNode[] => {
    const portals: ReactNode[] = [];
    for (const [content, container, key] of [...boundItems, ...headerBoundItems]) {
        portals.push(createPortal(content, container, key));
    }
    return portals;
};

/** Per-component customization for {@link useListElement}. */
type ListElementOptions = {
    /** Renders the element's children from the live handle (column view). */
    scope?: (handle: ListHandle) => ReactNode;
    /** Resolves the widget's dropdown surface for dropdown-style components. */
    resolveDropDown?: (widget: Gtk.Widget) => DropDownLike | null;
};

/**
 * Renders a virtualized list intrinsic element with its bound-item portals.
 *
 * Each public list component is a thin generic-typed wrapper over this hook: it
 * splits the controller props from the element props, captures the widget, and
 * emits the element plus its portals, so the only per-component difference is the
 * element name, the public prop type, and the optional column scope.
 *
 * @param elementType - The element's slot-splitting host component to render.
 * @param props - The merged public props, including an optional caller ref.
 * @param options - Per-component customization: the column-view child scope and
 *   the dropdown-surface resolver.
 * @returns The rendered node plus the live handle.
 */
const useListElement = (
    elementType: (props: Record<string, unknown>) => ReactNode,
    props: Record<string, unknown> & { ref?: Ref<Gtk.Widget>; children?: ReactNode },
    options?: ListElementOptions,
): { node: ReactNode; handle: ListHandle } => {
    const { ref, children, ...rest } = props;
    const { controllerProps, elementProps } = splitProps(rest);
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

/**
 * Virtualized scrollable list that renders items from a flat or tree data model.
 *
 * Wraps `GtkListView` with React-managed item rendering via portals,
 * supporting single/multi selection, section headers, and tree expansion.
 */
export function GtkListView<T = unknown, S = unknown>(
    props: ListViewProps<T, S> & { children?: ReactNode; ref?: Ref<Gtk.ListView> },
): ReactNode {
    return useListElement(GtkListViewElement, props as Record<string, unknown> & { ref?: Ref<Gtk.Widget> }).node;
}

/**
 * Virtualized scrollable grid that renders items in a multi-column layout.
 *
 * Wraps `GtkGridView` with React-managed item rendering via portals,
 * supporting single/multi selection.
 */
export function GtkGridView<T = unknown>(
    props: GridViewProps<T> & { children?: ReactNode; ref?: Ref<Gtk.GridView> },
): ReactNode {
    return useListElement(GtkGridViewElement, props as Record<string, unknown> & { ref?: Ref<Gtk.Widget> }).node;
}

/**
 * Single-selection dropdown widget with React-managed item rendering.
 *
 * Wraps `GtkDropDown` with portal-based factories, supporting custom
 * item templates, separate list-item templates, and section headers.
 */
export function GtkDropDown<T = unknown, S = unknown>(
    props: DropDownProps<T, S> & { children?: ReactNode; ref?: Ref<Gtk.DropDown> },
): ReactNode {
    return useListElement(GtkDropDownElement, props as Record<string, unknown> & { ref?: Ref<Gtk.Widget> }, {
        resolveDropDown: resolveDropDownWidget,
    }).node;
}

/**
 * Libadwaita combo row with React-managed item rendering.
 *
 * Wraps `AdwComboRow` with portal-based factories, providing a
 * preferences-style dropdown row with custom item templates and
 * section headers.
 */
export function AdwComboRow<T = unknown, S = unknown>(
    props: DropDownProps<T, S> & { children?: ReactNode; ref?: Ref<Gtk.Widget> },
): ReactNode {
    return useListElement(AdwComboRowElement, props as Record<string, unknown> & { ref?: Ref<Gtk.Widget> }, {
        resolveDropDown: resolveComboRow,
    }).node;
}

/**
 * Drives a `GtkColumnView`, sharing its settled list controller with the
 * `<GtkColumnViewColumn>` children through the column-view context.
 *
 * The columns are real reconciler elements: their order, insertion, and
 * removal flow through the host config's ordered-insert table row like any
 * ordered container. This component renders the column-view element with the
 * columns as its children inside the context provider, and subscribes to the
 * ordered-insert attach events on its widget so every column insertion,
 * reorder, or removal schedules one coalesced column settle.
 *
 * @internal
 */
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
    useLayoutEffect(() => {
        if (!controller) return;
        const widget = controller.getWidget();
        if (!(widget instanceof Gtk.ColumnView)) return;
        return onOrderedAttach(widget, () => controller.scheduleColumnSettle());
    }, [controller]);
    return node;
}

/**
 * Multi-column sortable list with React-managed cell rendering.
 *
 * Wraps `GtkColumnView` with portal-based factories. Use the
 * `<GtkColumnViewColumn>` component to define columns, passing an optional
 * `headerMenu={<GMenu>…</GMenu>}` for the column header's context menu.
 */
export const GtkColumnView: typeof GtkColumnViewBase = GtkColumnViewBase;

/**
 * Declares one column of a `GtkColumnView`, with header and per-row cell
 * rendering. Place it as a child of `<GtkColumnView>`.
 */
export const GtkColumnViewColumn: <T = unknown>(props: ColumnViewColumnProps<T>) => ReactNode = ColumnViewColumn;

/**
 * Declares one column of a `GtkColumnView`.
 *
 * Renders the real `GtkColumnViewColumn` element carrying the column's GObject
 * props, constructing the cell factory it is built with and the optional
 * sorter as regular construct props. The cell renderer and the column-view
 * registration are owned here: the component registers its
 * {@link ColumnController} on the list controller shared through the
 * column-view context, routes `renderCell` changes to it, and unregisters on
 * unmount. An optional `headerMenu` `<GMenu>` flows through the element's
 * `headerMenu` slot prop.
 *
 * @param props - The column definition and optional header menu.
 */
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
