import type * as Gtk from "@gtkx/gi/gtk";
import { type Context, createContext, type RefObject, useContext } from "react";
import type { TreeRenderContext } from "./cell.js";
import type { ItemResolver } from "./utils/item-resolver.js";

export type ColumnRegistration = {
    id: string;
    column: Gtk.ColumnViewColumn;
    sortable: boolean;
};

export type ColumnViewContextValue = {
    columnView: RefObject<Gtk.ColumnView | null>;
    resolver: ItemResolver<unknown, unknown>;
    tree: TreeRenderContext;
    estimatedItemHeight?: number | undefined;
    register(registration: ColumnRegistration): void;
    unregister(id: string): void;
};

export const ColumnViewContext: Context<ColumnViewContextValue | null> = createContext<ColumnViewContextValue | null>(
    null,
);

export const useColumnViewContext = (): ColumnViewContextValue => {
    const context = useContext(ColumnViewContext);
    if (context === null) {
        throw new Error("<ColumnViewColumn> must be rendered inside a <ColumnView>.");
    }
    return context;
};
