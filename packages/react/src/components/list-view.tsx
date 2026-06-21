import type * as Gio from "@gtkx/gi/gio";
import type * as Gtk from "@gtkx/gi/gtk";
import type { ReactNode, Ref } from "react";
import type { ListViewProps } from "../utils/element-props.js";
import { CollectionView, type ModelBinding } from "./collection-view.js";
import type { SlotRenderer } from "./list-slot.js";

const LIST_VIEW_ELEMENT = "GtkListView";

const factoryBinding = {
    install: (widget: Gtk.ListView, factory: Gtk.SignalListItemFactory) => widget.setFactory(factory),
    uninstall: (widget: Gtk.ListView) => widget.setFactory(null),
};

const headerFactoryBinding = {
    install: (widget: Gtk.ListView, factory: Gtk.SignalListItemFactory) => widget.setHeaderFactory(factory),
    uninstall: (widget: Gtk.ListView) => widget.setHeaderFactory(null),
};

const modelBinding: ModelBinding<Gtk.ListView> = {
    install: (widget, model) => widget.setModel(model as Gtk.SelectionModel),
};

type ListViewComponentProps<T, S> = ListViewProps<T, S> & {
    ref?: Ref<Gtk.ListView | null> | undefined;
    estimatedItemHeight?: number | undefined;
    estimatedItemWidth?: number | undefined;
};

/**
 * A `Gtk.ListView` driven by a controlled `items` array or an external `Gio.ListModel`.
 *
 * In controlled mode each item declares an `id` and a `value`; the GTK side holds only positions,
 * and `renderItem(value, row?)` renders the value into each realized row (receiving the
 * `Gtk.TreeListRow` for tree items). Trees are formed by item `children` with optional
 * `autoexpand`, per-item `hideExpander`/`indentForDepth`/`indentForIcon`, and section headers via
 * `renderHeader`. Selection follows `selectionMode`, controlled `selected` ids, and
 * `onSelectionChanged`. In model mode the supplied selection model is used directly and
 * `renderItem` receives the actual stored object. The ref is forwarded to the underlying
 * `Gtk.ListView`.
 *
 * @typeParam T - The value type of regular items.
 * @typeParam S - The value type of section headers.
 * @param props - The list configuration plus any underlying `Gtk.ListView` props.
 * @returns The rendered list view.
 */
export const GtkListView = <T = unknown, S = unknown>(props: ListViewComponentProps<T, S>): ReactNode => {
    const {
        ref,
        items,
        model,
        renderItem,
        autoexpand,
        renderHeader,
        selected,
        selectionMode,
        onSelectionChanged,
        estimatedItemHeight,
        estimatedItemWidth,
        ...intrinsicProps
    } = props as ListViewProps<T, S> & {
        ref?: Ref<Gtk.ListView | null>;
        estimatedItemHeight?: number;
        estimatedItemWidth?: number;
        [key: string]: unknown;
    };

    const renderItemFn = renderItem as (item: T, row?: Gtk.TreeListRow | null) => ReactNode;
    const slotRenderer: SlotRenderer<T, S> = (value, treeRow) =>
        treeRow === null ? renderItemFn(value as T) : renderItemFn(value as T, treeRow);

    const useHeader = model === undefined && typeof renderHeader === "function";

    return (
        <CollectionView<T, S, Gtk.ListView>
            element={LIST_VIEW_ELEMENT}
            intrinsicProps={intrinsicProps}
            ref={ref}
            items={model === undefined ? items : undefined}
            model={model as Gio.ListModel | undefined}
            renderItem={slotRenderer}
            autoexpand={autoexpand}
            renderHeader={useHeader ? (value) => renderHeader?.(value as S) ?? null : undefined}
            estimatedHeight={estimatedItemHeight}
            estimatedWidth={estimatedItemWidth}
            selected={selected}
            selectionMode={selectionMode}
            onSelectionChanged={onSelectionChanged}
            factoryBinding={factoryBinding}
            headerFactoryBinding={useHeader ? headerFactoryBinding : undefined}
            modelBinding={modelBinding}
        />
    );
};
