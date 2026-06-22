import type * as Gtk from "@gtkx/gi/gtk";
import { type Context, createContext, type RefObject, useContext } from "react";
import type { ItemResolver } from "../utils/item-resolver.js";

export interface ColumnRegistration {
    id: string;
    column: Gtk.ColumnViewColumn;
    sortable: boolean;
}

export interface ColumnViewContextValue {
    columnView: RefObject<Gtk.ColumnView | null>;
    resolver: ItemResolver<unknown, unknown>;
    register(registration: ColumnRegistration): void;
    unregister(id: string): void;
}

export const ColumnViewContext: Context<ColumnViewContextValue | null> = createContext<ColumnViewContextValue | null>(
    null,
);

export const useColumnViewContext = (): ColumnViewContextValue => {
    const context = useContext(ColumnViewContext);
    if (context === null) {
        throw new Error("<GtkColumnViewColumn> must be rendered inside a <GtkColumnView>.");
    }
    return context;
};
