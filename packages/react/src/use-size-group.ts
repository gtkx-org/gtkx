import type * as Gtk from "@gtkx/gi/gtk";
import { createContext, type RefObject, useLayoutEffect, useRef } from "react";

/**
 * Membership registry shared from a `<GtkSizeGroup>` to the
 * `<GtkSizeGroup.Widget>` markers nested anywhere within its React subtree.
 *
 * The registry owns the canonical member set and reconciles it against the
 * backing `Gtk.SizeGroup` as the group becomes available, so a marker may opt
 * its widget in before the group's own backing object has mounted.
 */
export interface SizeGroupRegistry {
    /**
     * Opts `widget` into the group. Deduplicates on the member set and adds the
     * widget to the backing `Gtk.SizeGroup` once it is present.
     *
     * @param widget - The widget to group.
     */
    addMember(widget: Gtk.Widget): void;
    /**
     * Removes `widget` from the group, reversing a prior {@link addMember}.
     *
     * @param widget - The widget to ungroup.
     */
    removeMember(widget: Gtk.Widget): void;
}

/**
 * Context carrying the innermost enclosing {@link SizeGroupRegistry}.
 *
 * Nested `<GtkSizeGroup>` providers shadow one another, so a
 * `<GtkSizeGroup.Widget>` always resolves the nearest group — reproducing the
 * innermost-wins, cross-subtree membership semantics without walking the GTK
 * widget tree. A `null` value means there is no enclosing group.
 */
export const SizeGroupContext = createContext<SizeGroupRegistry | null>(null);

/**
 * State returned by {@link useSizeGroup}: the ref to attach to the backing
 * `Gtk.SizeGroup` element and the registry to publish through
 * {@link SizeGroupContext}.
 */
export interface SizeGroupState {
    /** Ref to bind to the `<GtkSizeGroup>` intrinsic element. */
    readonly sizeGroupRef: RefObject<Gtk.SizeGroup | null>;
    /** Stable registry to provide to descendant markers. */
    readonly registry: SizeGroupRegistry;
}

/**
 * Owns the membership state for one `<GtkSizeGroup>`.
 *
 * Holds a stable registry whose member set is reconciled against the backing
 * `Gtk.SizeGroup`: a marker registering before the group mounts is recorded in
 * the set and flushed into the group from a layout effect once its element ref
 * resolves. Because layout effects run child-before-parent, the provider's
 * effect runs after every descendant marker has populated the set, so the flush
 * applies the full membership in one pass.
 *
 * @returns The element ref and the registry to share through context.
 */
export function useSizeGroup(): SizeGroupState {
    const sizeGroupRef = useRef<Gtk.SizeGroup | null>(null);
    const stateRef = useRef<{ members: Set<Gtk.Widget>; registry: SizeGroupRegistry } | null>(null);

    if (!stateRef.current) {
        const members = new Set<Gtk.Widget>();
        const registry: SizeGroupRegistry = {
            addMember(widget) {
                if (members.has(widget)) return;
                members.add(widget);
                sizeGroupRef.current?.addWidget(widget);
            },
            removeMember(widget) {
                if (!members.delete(widget)) return;
                sizeGroupRef.current?.removeWidget(widget);
            },
        };
        stateRef.current = { members, registry };
    }

    const state = stateRef.current;

    useLayoutEffect(() => {
        const group = sizeGroupRef.current;
        if (!group) return;
        for (const widget of state.members) group.addWidget(widget);
        return () => {
            for (const widget of state.members) group.removeWidget(widget);
        };
    }, [state]);

    return { sizeGroupRef, registry: state.registry };
}
