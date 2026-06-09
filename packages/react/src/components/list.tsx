import type * as Adw from "@gtkx/gi/adw";
import * as Gtk from "@gtkx/gi/gtk";
import type {
    AdwComboRowProps,
    GtkColumnViewProps,
    GtkDropDownProps,
    GtkGridViewProps,
    GtkListViewProps,
} from "@gtkx/react-jsx/jsx";
import {
    createElement,
    type ReactNode,
    type Ref,
    useEffect,
    useLayoutEffect,
    useMemo,
    useReducer,
    useRef,
    useState,
} from "react";
import type { ColumnViewColumnProps, ColumnViewProps, DropDownProps, GridViewProps, ListViewProps } from "../jsx.js";
import type { BoundItem } from "../nodes/internal/bound-item.js";
import { createPortal } from "../portal.js";
import { useMergedRefs } from "../use-merged-refs.js";
import { setColumnViewController } from "./internal/column-view-registry.js";
import { ListController, type ListControllerProps } from "./internal/list-controller.js";
import { useMenuEntries } from "./menu.js";

const GtkListViewElement = "GtkListView" as const;
const GtkGridViewElement = "GtkGridView" as const;
const GtkColumnViewElement = "GtkColumnView" as const;
const GtkColumnViewColumnElement = "GtkColumnViewColumn" as const;
const GtkDropDownElement = "GtkDropDown" as const;
const AdwComboRowElement = "AdwComboRow" as const;

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
 * @param scope - The column scope rendered as the element's children (column view).
 * @param onHandle - Receives the live handle so a wrapper can drive columns.
 */
const useListElement = (
    elementType: string,
    props: Record<string, unknown> & { ref?: Ref<Gtk.Widget>; children?: ReactNode },
    scope?: ReactNode,
    onHandle?: (handle: ListHandle) => void,
): ReactNode => {
    const { ref, children, ...rest } = props;
    const { controllerProps, elementProps } = splitProps(rest);
    const handle = useListController(controllerProps);
    onHandle?.(handle);
    const mergedRef = useMergedRefs<Gtk.Widget>(handle.setWidget, ref);
    const boundItems = handle.controller?.getBoundItems() ?? EMPTY_BOUND_ITEMS;
    const headerBoundItems = handle.controller?.getHeaderBoundItems() ?? EMPTY_BOUND_ITEMS;
    const portals = useMemo(() => renderPortals(boundItems, headerBoundItems), [boundItems, headerBoundItems]);
    return (
        <>
            {createElement(elementType, { ...elementProps, ref: mergedRef }, scope ?? children)}
            {portals}
        </>
    );
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
    return useListElement(GtkListViewElement, props as Record<string, unknown> & { ref?: Ref<Gtk.Widget> });
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
    return useListElement(GtkGridViewElement, props as Record<string, unknown> & { ref?: Ref<Gtk.Widget> });
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
    return useListElement(GtkDropDownElement, props as Record<string, unknown> & { ref?: Ref<Gtk.Widget> });
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
    return useListElement(AdwComboRowElement, props as Record<string, unknown> & { ref?: Ref<Gtk.Widget> });
}

/**
 * Drives a `GtkColumnView`, publishing its settled list controller so the
 * `<GtkColumnViewColumn>` children reach it as the reconciler attaches them.
 *
 * The columns are real reconciler elements: their order, insertion, and removal
 * flow through the host config like any ordered container, so this component
 * only renders the column-view element with the columns as its children and
 * records the controller keyed by the live column-view widget.
 *
 * @internal
 */
function GtkColumnViewBase<T = unknown, S = unknown>(
    props: GenericColumnViewProps<T, S> & { children?: ReactNode; ref?: Ref<Gtk.ColumnView> },
): ReactNode {
    const { children, ...rest } = props as Record<string, unknown> & { children?: ReactNode };
    return useListElement(
        GtkColumnViewElement,
        rest as Record<string, unknown> & { ref?: Ref<Gtk.Widget> },
        children as ReactNode,
        (handle) => {
            const widget = handle.controller?.getWidget() ?? null;
            if (widget instanceof Gtk.ColumnView && handle.controller) {
                setColumnViewController(widget, handle.controller);
            }
        },
    );
}

/**
 * Multi-column sortable list with React-managed cell rendering.
 *
 * Wraps `GtkColumnView` with portal-based factories. Use the
 * `<GtkColumnViewColumn>` component to define columns, passing
 * `<MenuItem>` / `<MenuSection>` / `<MenuSubmenu>` children to build the
 * column header context menu.
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
 * Collects the column's header-menu entries from its `<MenuItem>` /
 * `<MenuSection>` / `<MenuSubmenu>` children, then renders the real
 * `GtkColumnViewColumn` intrinsic element carrying the column's GObject props
 * plus the cell renderer and collected menu entries the reconciler builds the
 * column's cell factory and header menu from. The menu collector scope is
 * rendered alongside the element so the markers populate `entries`.
 *
 * @param props - The column definition and optional header-menu children.
 */
function ColumnViewColumn<T = unknown>({ children, ...rest }: ColumnViewColumnProps<T>): ReactNode {
    const { entries, scope } = useMenuEntries(children);
    return (
        <>
            {scope}
            {createElement(GtkColumnViewColumnElement, { ...rest, menuEntries: entries })}
        </>
    );
}
