import type { ReactNode } from "react";
import type { GtkSizeGroupProps, SizeGroupWidgetProps } from "../jsx.js";

const GtkSizeGroupElement = "GtkSizeGroup" as const;
const SizeGroupWidgetElement = "SizeGroupWidget" as const;

/**
 * Declarative wrapper for `Gtk.SizeGroup`.
 *
 * Renders as a transparent virtual element: its children appear in the GTK
 * tree exactly where the wrapper sits, as if it were a fragment. Widgets opt
 * into the group by being wrapped in `<GtkSizeGroup.Widget>` anywhere within
 * the subtree (including deeply nested across other containers, since
 * lookup walks the React parent chain rather than the GTK widget tree).
 *
 * The `mode` prop reactively drives `Gtk.SizeGroup.setMode` — toggle it at
 * runtime to enable, disable, or change the dimension along which grouped
 * widgets share a size request.
 *
 * @example
 * ```tsx
 * <GtkBox>
 *   <GtkSizeGroup mode={Gtk.SizeGroupMode.HORIZONTAL}>
 *     <GtkFrame>
 *       <GtkSizeGroup.Widget><GtkDropDown ... /></GtkSizeGroup.Widget>
 *     </GtkFrame>
 *     <GtkFrame>
 *       <GtkSizeGroup.Widget><GtkDropDown ... /></GtkSizeGroup.Widget>
 *     </GtkFrame>
 *   </GtkSizeGroup>
 * </GtkBox>
 * ```
 *
 * @public
 */
export const GtkSizeGroup = Object.assign(
    (props: GtkSizeGroupProps): ReactNode => (
        <GtkSizeGroupElement mode={props.mode}>{props.children}</GtkSizeGroupElement>
    ),
    {
        /**
         * Marks a single widget as a member of the enclosing `<GtkSizeGroup>`.
         *
         * Transparent in the GTK tree — the wrapped widget attaches to the
         * marker's grandparent container.
         */
        Widget: (props: SizeGroupWidgetProps): ReactNode => (
            <SizeGroupWidgetElement>{props.children}</SizeGroupWidgetElement>
        ),
    },
);
