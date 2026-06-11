import type * as Adw from "@gtkx/gi/adw";
import * as Gtk from "@gtkx/gi/gtk";
import type { AdwComboRowProps } from "@gtkx/jsx/adw";
import type { GtkColumnViewProps, GtkDropDownProps, GtkGridViewProps, GtkListViewProps } from "@gtkx/jsx/gtk";
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
import { onOrderedAttach } from "../attach-events.js";
import type { ColumnViewColumnProps, ColumnViewProps, DropDownProps, GridViewProps, ListViewProps } from "../jsx.js";
import type { BoundItem } from "../nodes/internal/bound-item.js";
import { createPortal } from "../portal.js";
import { useMergedRefs } from "../use-merged-refs.js";
import { ColumnController } from "./internal/column-controller.js";
import { ColumnViewContext } from "./internal/column-view-context.js";
import { ListController, type ListControllerProps } from "./internal/list-controller.js";

const GtkListViewElement = "GtkListView" as const;
const GtkGridViewElement = "GtkGridView" as const;
const GtkColumnViewElement = "GtkColumnView" as const;
const GtkColumnViewColumnElement = "GtkColumnViewColumn" as const;
const GtkDropDownElement = "GtkDropDown" as const;
const AdwComboRowElement = "AdwComboRow" as const;
const WrapperNodeElement = "__GTKX_WRAPPER_NODE__" as const;

type ListViewOwnKeys =
    | "items"
    | "model"
    | "renderItem"
    | "renderHeader"
    | "autoexpand"
    | "selected"
    | "onSelectionChanged"
    | "selectionMode"
    | "estimatedItemHeight"
    | "estimatedItemWidth";
type DropDownOwnKeys =
    | "items"
    | "model"
    | "renderItem"
    | "renderListItem"
    | "renderHeader"
    | "selectedId"
    | "onSelectionChanged";
type ColumnViewOwnKeys = "items" | "model" | "renderHeader" | "selected" | "onSelectionChanged" | "selectionMode";

type GenericListViewProps<T, S> = Omit<GtkListViewProps, ListViewOwnKeys> & ListViewProps<T, S>;
type GenericGridViewProps<T> = Omit<GtkGridViewProps, ListViewOwnKeys> & GridViewProps<T>;
type GenericDropDownProps<T, S> = Omit<GtkDropDownProps, DropDownOwnKeys> & DropDownProps<T, S>;
type GenericComboRowProps<T, S> = Omit<AdwComboRowProps, DropDownOwnKeys> & DropDownProps<T, S>;
type GenericColumnViewProps<T, S> = Omit<GtkColumnViewProps, ColumnViewOwnKeys> & ColumnViewProps<T, S>;

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
const useListController = (controllerProps: ListControllerProps): ListHandle => {
    const [widget, setWidget] = useState<Gtk.Widget | null>(null);
    const [, rerender] = useReducer((x: number) => x + 1, 0);
    const controllerRef = useRef<ListController | null>(null);
    const prevPropsRef = useRef<ListControllerProps>(controllerProps);
    const appliedFirstUpdate = useRef(false);

    if (widget && !controllerRef.current) {
        controllerRef.current = new ListController(widget, controllerProps, rerender);
        prevPropsRef.current = controllerProps;
        appliedFirstUpdate.current = false;
    }

    // biome-ignore lint/correctness/useExhaustiveDependencies: widget re-attaches the controller built from it in render
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

/**
 * Renders a virtualized list intrinsic element with its bound-item portals.
 *
 * Each public list component is a thin generic-typed wrapper over this hook: it
 * splits the controller props from the element props, captures the widget, and
 * emits the element plus its portals, so the only per-component difference is the
 * element name, the public prop type, and the optional column scope.
 *
 * @param elementType - The intrinsic element name to render.
 * @param props - The merged public props, including an optional caller ref.
 * @param scope - Renders the element's children from the live handle (column view).
 * @returns The rendered node plus the live handle.
 */
const useListElement = (
    elementType: string,
    props: Record<string, unknown> & { ref?: Ref<Gtk.Widget>; children?: ReactNode },
    scope?: (handle: ListHandle) => ReactNode,
): { node: ReactNode; handle: ListHandle } => {
    const { ref, children, ...rest } = props;
    const { controllerProps, elementProps } = splitProps(rest);
    const handle = useListController(controllerProps);
    const mergedRef = useMergedRefs<Gtk.Widget>(handle.setWidget, ref);
    const boundItems = handle.controller?.getBoundItems() ?? EMPTY_BOUND_ITEMS;
    const headerBoundItems = handle.controller?.getHeaderBoundItems() ?? EMPTY_BOUND_ITEMS;
    const portals = useMemo(() => renderPortals(boundItems, headerBoundItems), [boundItems, headerBoundItems]);
    const node = (
        <>
            {createElement(elementType, { ...elementProps, ref: mergedRef }, scope ? scope(handle) : children)}
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
    props: GenericListViewProps<T, S> & { children?: ReactNode; ref?: Ref<Gtk.ListView> },
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
    props: GenericGridViewProps<T> & { children?: ReactNode; ref?: Ref<Gtk.GridView> },
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
    props: GenericDropDownProps<T, S> & { children?: ReactNode; ref?: Ref<Gtk.DropDown> },
): ReactNode {
    return useListElement(GtkDropDownElement, props as Record<string, unknown> & { ref?: Ref<Gtk.Widget> }).node;
}

/**
 * Libadwaita combo row with React-managed item rendering.
 *
 * Wraps `AdwComboRow` with portal-based factories, providing a
 * preferences-style dropdown row with custom item templates and
 * section headers.
 */
export function AdwComboRow<T = unknown, S = unknown>(
    props: GenericComboRowProps<T, S> & { children?: ReactNode; ref?: Ref<Adw.ComboRow> },
): ReactNode {
    return useListElement(AdwComboRowElement, props as Record<string, unknown> & { ref?: Ref<Gtk.Widget> }).node;
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
    props: GenericColumnViewProps<T, S> & { children?: ReactNode; ref?: Ref<Gtk.ColumnView> },
): ReactNode {
    const { children, ...rest } = props as Record<string, unknown> & { children?: ReactNode };
    const { node, handle } = useListElement(
        GtkColumnViewElement,
        rest as Record<string, unknown> & { ref?: Ref<Gtk.Widget> },
        (live) => <ColumnViewContext.Provider value={live.controller}>{children}</ColumnViewContext.Provider>,
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
 * Renders the real `GtkColumnViewColumn` intrinsic element carrying the
 * column's GObject props, constructing the cell factory it is built with and
 * the optional sorter as regular construct props. The cell renderer and the
 * column-view registration are owned here: the component registers its
 * {@link ColumnController} on the list controller shared through the
 * column-view context, routes `renderCell` changes to it, and unregisters on
 * unmount. An optional `headerMenu` `<GMenu>` lands in the column's
 * `headerMenu` slot.
 *
 * @param props - The column definition and optional header menu.
 */
function ColumnViewColumn<T = unknown>({
    headerMenu,
    renderCell,
    sortable,
    ...rest
}: ColumnViewColumnProps<T>): ReactNode {
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

    return createElement(
        GtkColumnViewColumnElement,
        { ...rest, factory: controller.factory, sorter: sortable === true ? sorterRef.current : null },
        headerMenu != null
            ? createElement(WrapperNodeElement, { kind: "slot", propName: "headerMenu" }, headerMenu)
            : null,
    );
}
