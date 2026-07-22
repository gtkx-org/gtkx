import type * as GObject from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import { useSignal } from "@gtkx/react";
import { type RefProp, resolveRefProp, useObjectValue } from "@gtkx/react/internal";
import { useLayoutEffect, useRef } from "react";
import type { ItemResolver } from "../utils/item-resolver.js";

type DropDownSelectionObject = GObject.Object & {
    getSelected(): number;
    setSelected(position: number): void;
};

type DropDownSelectionOptions<T, S> = {
    widget: RefProp<DropDownSelectionObject>;
    resolver: ItemResolver<T, S>;
    selectedId: string | null | undefined;
    onSelectionChanged: ((id: string) => void) | null | undefined;
};

const normalizeSelected = (position: number): number =>
    position === Gtk.INVALID_LIST_POSITION || position < 0 ? -1 : position;

export const useDropDownSelection = <T, S>(options: DropDownSelectionOptions<T, S>): number => {
    const { widget, resolver, selectedId, onSelectionChanged } = options;
    const resolved = resolveRefProp(widget);

    const selectedPosition = useObjectValue(widget, "notify::selected", (object) =>
        object === null ? -1 : normalizeSelected(object.getSelected()),
    );

    const resolverRef = useRef(resolver);
    resolverRef.current = resolver;
    const onSelectionChangedRef = useRef(onSelectionChanged);
    onSelectionChangedRef.current = onSelectionChanged;

    useLayoutEffect(() => {
        if (resolved === null || selectedId === undefined || selectedId === null) return;
        const position = resolverRef.current.positionOfId(selectedId);
        if (position < 0) return;
        if (normalizeSelected(resolved.getSelected()) !== position) resolved.setSelected(position);
    }, [resolved, selectedId, resolver]);

    useSignal(widget, "notify::selected", () => {
        if (resolved === null) return;
        const position = normalizeSelected(resolved.getSelected());
        if (position < 0) return;
        const id = resolverRef.current.idOf(position);
        if (id !== undefined) onSelectionChangedRef.current?.(id);
    });

    return selectedPosition;
};
