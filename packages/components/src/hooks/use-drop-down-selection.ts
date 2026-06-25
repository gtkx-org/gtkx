import type * as GObject from "@gtkx/gi/gobject";
import { useSignal } from "@gtkx/react";
import { type GObjectTarget, resolveGObjectTarget, useGObjectSnapshot } from "@gtkx/react/internal";
import { useLayoutEffect, useRef } from "react";
import type { ItemResolver } from "../utils/item-resolver.js";

interface DropDownSelectionTarget extends GObject.Object {
    getSelected(): number;
    setSelected(position: number): void;
}

interface DropDownSelectionOptions<T, S> {
    widget: GObjectTarget<DropDownSelectionTarget>;
    resolver: ItemResolver<T, S>;
    selectedId: string | null | undefined;
    onSelectionChanged: ((id: string) => void) | null | undefined;
}

const GTK_INVALID_LIST_POSITION = 4294967295;

const normalizeSelected = (position: number): number =>
    position === GTK_INVALID_LIST_POSITION || position < 0 ? -1 : position;

export const useDropDownSelection = <T, S>(options: DropDownSelectionOptions<T, S>): number => {
    const { widget, resolver, selectedId, onSelectionChanged } = options;
    const resolved = resolveGObjectTarget(widget);

    const selectedPosition = useGObjectSnapshot(widget, "notify::selected", (target) =>
        target === null ? -1 : normalizeSelected(target.getSelected()),
    );

    const resolverRef = useRef(resolver);
    resolverRef.current = resolver;
    const onSelectionChangedRef = useRef(onSelectionChanged);
    onSelectionChangedRef.current = onSelectionChanged;

    useLayoutEffect(() => {
        if (resolved === null || selectedId === undefined || selectedId === null) return;
        const position = resolverRef.current.positionOfKey(selectedId);
        if (position < 0) return;
        if (normalizeSelected(resolved.getSelected()) !== position) resolved.setSelected(position);
    }, [resolved, selectedId, resolver]);

    useSignal(widget, "notify::selected", () => {
        if (resolved === null) return;
        const position = normalizeSelected(resolved.getSelected());
        if (position < 0) return;
        const id = resolverRef.current.keyOf(position);
        if (id !== undefined) onSelectionChangedRef.current?.(id);
    });

    return selectedPosition;
};
