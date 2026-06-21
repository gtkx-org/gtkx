import type * as Gtk from "@gtkx/gi/gtk";
import { type Context, createContext, type RefObject, useContext } from "react";
import type { ItemResolver } from "../utils/item-resolver.js";

/**
 * Registration record a `GtkColumnViewColumn` contributes to its parent `GtkColumnView`.
 *
 * The parent uses it to wire per-column sorting: a sortable column participates in the column
 * view's sorter so `getSorter()` is populated and `sortByColumn` affects it.
 */
export interface ColumnRegistration {
    id: string;
    column: Gtk.ColumnViewColumn;
    sortable: boolean;
}

/**
 * The value carried by {@link ColumnViewContext}.
 *
 * It exposes the parent column view ref (for header-menu action resolution and sorter wiring), the
 * value resolver columns read to render their cells by position, and the registration sink columns
 * call as their backing `Gtk.ColumnViewColumn` materializes, updates, or is removed.
 */
export interface ColumnViewContextValue {
    columnView: RefObject<Gtk.ColumnView | null>;
    resolver: ItemResolver<unknown, unknown>;
    register(registration: ColumnRegistration): void;
    unregister(id: string): void;
}

/**
 * Context linking a `GtkColumnView` to the `GtkColumnViewColumn` children declared inside it.
 *
 * It is `null` outside a column view so that a column rendered without a parent fails loudly.
 */
export const ColumnViewContext: Context<ColumnViewContextValue | null> = createContext<ColumnViewContextValue | null>(
    null,
);

/**
 * Reads the surrounding {@link ColumnViewContext}, throwing when used outside a `GtkColumnView`.
 *
 * @returns The parent column view context value.
 * @throws If called outside a `GtkColumnView` subtree.
 */
export const useColumnViewContext = (): ColumnViewContextValue => {
    const context = useContext(ColumnViewContext);
    if (context === null) {
        throw new Error("<GtkColumnViewColumn> must be rendered inside a <GtkColumnView>.");
    }
    return context;
};
