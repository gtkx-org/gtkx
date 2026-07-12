import type * as Gtk from "@gtkx/gi/gtk";
import { GtkSizeGroup } from "@gtkx/jsx/gtk";
import { type ReactNode, type RefCallback, useCallback, useRef } from "react";

/** Props for {@link SizeGroup}. */
export type SizeGroupProps = {
    /** How the group equalizes sizes: horizontal, vertical, or both. */
    mode?: Gtk.SizeGroupMode | null | undefined;
    /** Render function receiving a ref callback used to register each member widget in the group. */
    children: (ref: RefCallback<Gtk.Widget>) => ReactNode;
};

type SizeGroupState = { group: Gtk.SizeGroup | null; members: Set<Gtk.Widget> };

/**
 * Creates a Gtk.SizeGroup that keeps its member widgets at a common size. Members are
 * registered through the ref callback passed to the children render function.
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
