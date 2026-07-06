import type * as Gtk from "@gtkx/gi/gtk";
import { GtkSizeGroup } from "@gtkx/jsx/gtk";
import { type ReactNode, type RefCallback, useCallback, useRef } from "react";

/**
 * Props for {@link SizeGroup}. `mode` selects the grouped dimension. `children`
 * is a function that receives a ref callback; attach it to every widget that
 * should share a size (`<GtkButton ref={ref} />`). Members may live in
 * different parents — a size group does not reparent them, it only ties their
 * size negotiation together.
 */
export type SizeGroupProps = {
    mode?: Gtk.SizeGroupMode | null | undefined;
    children: (ref: RefCallback<Gtk.Widget>) => ReactNode;
};

type SizeGroupState = { group: Gtk.SizeGroup | null; members: Set<Gtk.Widget> };

/**
 * Declarative wrapper over {@link Gtk.SizeGroup}. Renders the real size-group
 * element and hands its `children` function a ref callback that adds each
 * tagged widget to the group on mount and removes it on cleanup.
 */
export const SizeGroup = ({ mode, children }: SizeGroupProps): ReactNode => {
    const stateRef = useRef<SizeGroupState>({ group: null, members: new Set() });

    const setGroup = useCallback<RefCallback<Gtk.SizeGroup>>((group) => {
        stateRef.current.group = group;
        if (group) for (const member of stateRef.current.members) group.addWidget(member);
    }, []);

    const setMember = useCallback<RefCallback<Gtk.Widget>>((widget) => {
        if (widget === null) return;
        const state = stateRef.current;
        state.members.add(widget);
        state.group?.addWidget(widget);
        return () => {
            state.members.delete(widget);
            state.group?.removeWidget(widget);
        };
    }, []);

    return (
        <>
            <GtkSizeGroup ref={setGroup} mode={mode} />
            {children(setMember)}
        </>
    );
};
