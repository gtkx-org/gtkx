import type * as Gtk from "@gtkx/gi/gtk";
import type { ElementType, ReactNode, Ref } from "react";
import { useForwardedRef } from "../hooks/use-forwarded-ref.js";
import { type TopLevelSurface, useWindowPresentation } from "../hooks/use-window-presentation.js";

/**
 * The prop surface {@link withTopLevel} adds to an `Adw.Dialog` compound: the
 * window the dialog is presented against, read once when the dialog mounts.
 * Windows take no `parent`; a window's transient-for relationship is its
 * regular `transientFor` property prop.
 */
export interface TopLevelParentProps {
    /** The window the dialog is presented against, read at mount time. */
    parent?: Gtk.Window | null;
}

/**
 * Wraps a top-level surface element (a window/dialog intrinsic or its slotted
 * compound) into a component that presents the surface on mount and tears it
 * down on unmount through {@link useWindowPresentation}. An `Adw.Dialog`
 * compound additionally accepts {@link TopLevelParentProps.parent}, consumed at
 * present time and never forwarded to the element; a window's `transientFor`
 * passes through as a regular property prop. The caller's `ref` still receives
 * the backing surface.
 *
 * @typeParam P - The wrapped element's prop shape.
 * @param Underlying - The intrinsic element name or slotted compound to render.
 * @returns A component that drives the surface's lifecycle.
 */
export const withTopLevel = <P extends { children?: ReactNode }>(
    Underlying: ElementType,
): ((props: P) => ReactNode) => {
    const Element = Underlying;
    return (props: P): ReactNode => {
        const externalRef = (props as { ref?: Ref<TopLevelSurface | null> }).ref;
        const { children, parent, ...rest } = props as P & TopLevelParentProps;
        const capture = useWindowPresentation(parent ?? null);
        const [, ref] = useForwardedRef(externalRef, capture);
        return (
            <Element {...rest} ref={ref}>
                {children}
            </Element>
        );
    };
};
