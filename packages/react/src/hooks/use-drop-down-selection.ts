import type * as GObject from "@gtkx/gi/gobject";
import { useLayoutEffect, useRef } from "react";
import type { GObjectTarget } from "../utils/gobject-target.js";
import { resolveGobjectTarget } from "../utils/gobject-target.js";
import type { ItemResolver } from "../utils/item-resolver.js";
import { useGObjectSnapshot } from "./use-gobject-snapshot.js";
import { useSignal } from "./use-signal.js";

/**
 * The subset of `Gtk.DropDown`/`Adw.ComboRow` selection methods this hook drives.
 */
export interface DropDownSelectionTarget extends GObject.Object {
    getSelected(): number;
    setSelected(position: number): void;
}

/**
 * Configuration for {@link useDropDownSelection}.
 *
 * @typeParam T - The value type of regular items.
 * @typeParam S - The value type of section headers.
 */
export interface DropDownSelectionOptions<T, S> {
    widget: GObjectTarget<DropDownSelectionTarget>;
    resolver: ItemResolver<T, S>;
    selectedId: string | null | undefined;
    onSelectionChanged: ((id: string) => void) | null | undefined;
}

const GTK_INVALID_LIST_POSITION = 4294967295;

const normalizeSelected = (position: number): number =>
    position === GTK_INVALID_LIST_POSITION || position < 0 ? -1 : position;

/**
 * Drives and reports the single selection of a `Gtk.DropDown` or `Adw.ComboRow`.
 *
 * Selection flows through the GTK widget, not React state. A controlled `selectedId` is resolved to
 * a position through the value resolver (by id lookup, never numeric parse) and applied with
 * `setSelected` in a layout effect. The widget's `notify::selected` signal is read through
 * `useGObjectSnapshot` so the returned `selectedPosition` tracks every selection change — including
 * those made imperatively on the widget — and re-renders the face slot accordingly. The same signal
 * is mapped back to an id and reported through `onSelectionChanged` as a single string.
 *
 * @typeParam T - The value type of regular items.
 * @typeParam S - The value type of section headers.
 * @param options - The widget, the value resolver, and the controlled selection props.
 * @returns The currently selected position, or `-1` when nothing is selected.
 */
export const useDropDownSelection = <T, S>(options: DropDownSelectionOptions<T, S>): number => {
    const { widget, resolver, selectedId, onSelectionChanged } = options;
    const resolved = resolveGobjectTarget(widget);

    const selectedPosition = useGObjectSnapshot(widget, "notify::selected", (target) =>
        target === null ? -1 : normalizeSelected(target.getSelected()),
    );

    const resolverRef = useRef(resolver);
    resolverRef.current = resolver;
    const onSelectionChangedRef = useRef(onSelectionChanged);
    onSelectionChangedRef.current = onSelectionChanged;

    useLayoutEffect(() => {
        if (resolved === null || selectedId === undefined || selectedId === null) return;
        const position = resolverRef.current.positionOf(selectedId);
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
