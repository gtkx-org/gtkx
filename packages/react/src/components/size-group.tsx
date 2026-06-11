import type * as Gtk from "@gtkx/gi/gtk";
import { Children, cloneElement, type ReactNode, useCallback, useContext } from "react";
import { WRAPPER_NODE_ELEMENT } from "../instance.js";
import type { SizeGroupProps, SizeGroupWidgetProps } from "../jsx.js";
import { SizeGroupContext, type SizeGroupRegistry, useSizeGroup } from "../use-size-group.js";
import { useChildWidgetRegistration, type WidgetChild } from "./internal/use-child-widget-registration.js";

const GtkSizeGroupElement = "GtkSizeGroup" as const;
const WrapperNodeElement = WRAPPER_NODE_ELEMENT;

const ORPHAN_MESSAGE = "GtkSizeGroup.Widget must be nested inside a GtkSizeGroup";

/**
 * Registers a `<GtkSizeGroup.Widget>`'s single child with the enclosing group.
 *
 * The child's widget is captured through a callback ref merged with any ref the
 * child already carries, then added to the {@link SizeGroupRegistry} from a
 * layout effect and removed on cleanup. Throws when no enclosing
 * `<GtkSizeGroup>` provides a registry.
 *
 * @param registry - The membership registry from the enclosing group.
 * @param child - The single widget element to group.
 */
const SizeGroupMember = ({ registry, child }: { registry: SizeGroupRegistry; child: WidgetChild }): ReactNode => {
    const register = useCallback(
        (widget: Gtk.Widget) => {
            registry.addMember(widget);
            return () => registry.removeMember(widget);
        },
        [registry],
    );
    const captureWidget = useChildWidgetRegistration(child, register);

    return <WrapperNodeElement kind="transparent">{cloneElement(child, { ref: captureWidget })}</WrapperNodeElement>;
};

/**
 * Declarative wrapper for `Gtk.SizeGroup`.
 *
 * Renders the backing `Gtk.SizeGroup` as a childless element and shares its
 * membership registry through context, so widgets opt into the group by being
 * wrapped in `<GtkSizeGroup.Widget>` anywhere within the subtree — including
 * across separate widget subtrees, since lookup follows the React tree. Nested
 * groups shadow one another, so the innermost group wins.
 *
 * The `mode` prop reactively drives the dimension along which grouped widgets
 * share a size request; toggle it at runtime to enable, disable, or change it.
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
 */
export const GtkSizeGroup = Object.assign(
    (props: SizeGroupProps): ReactNode => {
        const { sizeGroupRef, registry } = useSizeGroup();
        return (
            <>
                <GtkSizeGroupElement ref={sizeGroupRef} mode={props.mode} />
                <SizeGroupContext.Provider value={registry}>{props.children}</SizeGroupContext.Provider>
            </>
        );
    },
    {
        /**
         * Marks a single widget as a member of the enclosing `<GtkSizeGroup>`.
         *
         * Transparent in the GTK tree — the wrapped widget attaches to the
         * marker's grandparent container. Throws when used outside a
         * `<GtkSizeGroup>`.
         */
        Widget: (props: SizeGroupWidgetProps): ReactNode => {
            const registry = useContext(SizeGroupContext);
            if (!registry) throw new Error(ORPHAN_MESSAGE);
            const child = Children.only(props.children) as WidgetChild;
            return <SizeGroupMember registry={registry} child={child} />;
        },
    },
);
