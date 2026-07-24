import type * as Gtk from "@gtkx/gi/gtk";
import { useLayoutEffect } from "react";
import { createHeaderFactory, createItemFactory, type FactoryContext } from "./collection-factories.js";

export type FactorySlot = "item" | "list" | "header";

export type FactoryHost = {
    setFactory?: (factory: Gtk.ListItemFactory | null) => void;
    setListFactory?: (factory: Gtk.ListItemFactory | null) => void;
    setHeaderFactory?: (factory: Gtk.ListItemFactory | null) => void;
};

const setFactorySlot = (host: FactoryHost, slot: FactorySlot, factory: Gtk.ListItemFactory | null): void => {
    if (slot === "item") host.setFactory?.(factory);
    else if (slot === "list") host.setListFactory?.(factory);
    else host.setHeaderFactory?.(factory);
};

const createFactory = (slot: FactorySlot, context: FactoryContext): Gtk.ListItemFactory => {
    if (slot === "header") return createHeaderFactory(context);
    return createItemFactory(context, slot === "list" ? "list" : null);
};

export const useFactorySlot = (
    host: FactoryHost | null,
    context: FactoryContext,
    slot: FactorySlot,
    enabled = true,
): void => {
    useLayoutEffect(() => {
        if (host === null || !enabled) return;
        setFactorySlot(host, slot, createFactory(slot, context));
        return () => setFactorySlot(host, slot, null);
    }, [host, context, slot, enabled]);
};
