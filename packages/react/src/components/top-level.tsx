import type * as Gtk from "@gtkx/gi/gtk";
import { type ElementType, type ReactNode, type Ref, useLayoutEffect, useRef, useState } from "react";
import { type AdwDialogLike, isAdwDialog } from "../gtype-predicates.js";
import { assignRef } from "../use-merged-refs.js";

/** A top-level surface: a window or an Adwaita dialog. */
type Surface = Gtk.Window | AdwDialogLike;

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
 * Presents `surface` and returns its teardown. A window is shown with
 * `present()` and torn down with `destroy()` after its default widget is
 * cleared — a `Gtk.Window` holds its default widget as a borrowed back-pointer
 * GObject finalization could leave dangling, so resetting it synchronously
 * while still alive is required. An `Adw.Dialog` is presented against the
 * given parent window and force-closed.
 */
const presentSurface = (surface: Surface, parent: Gtk.Window | null): (() => void) => {
    if (isAdwDialog(surface)) {
        surface.present(parent);
        return () => surface.forceClose();
    }
    surface.present();
    return () => {
        surface.setDefaultWidget(null);
        surface.destroy();
    };
};

/**
 * Drives the lifecycle of a top-level surface: captures its backing instance
 * through a callback ref, presents it once mounted against the parent the
 * props carried at that moment, and tears it down on unmount.
 *
 * @typeParam T - The concrete surface type the wrapped element backs.
 * @param externalRef - A caller ref to forward the surface to, or `undefined`.
 * @param parent - The window an `Adw.Dialog` surface is presented against.
 * @returns The capture ref to bind to the surface element.
 */
const useTopLevelSurface = <T extends Surface>(
    externalRef: Ref<T | null> | undefined,
    parent: Gtk.Window | null,
): ((instance: T | null) => void) => {
    const [surface, setSurface] = useState<Surface | null>(null);
    const parentRef = useRef(parent);
    parentRef.current = parent;

    useLayoutEffect(() => {
        if (!surface) return;
        return presentSurface(surface, parentRef.current);
    }, [surface]);

    return (instance: T | null): void => {
        setSurface(instance);
        assignRef(externalRef, instance);
    };
};

/**
 * Wraps a top-level surface element (a window/dialog intrinsic or its slotted
 * compound) into a component that presents the surface on mount and tears it
 * down on unmount. An `Adw.Dialog` compound additionally accepts
 * {@link TopLevelParentProps.parent}, consumed at present time and never
 * forwarded to the element; a window's `transientFor` passes through as a
 * regular property prop. The caller's `ref` still receives the backing
 * surface.
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
        const externalRef = (props as { ref?: Ref<Surface | null> }).ref;
        const { children, parent, ...rest } = props as P & TopLevelParentProps;
        const capture = useTopLevelSurface(externalRef, parent ?? null);
        return (
            <Element {...rest} ref={capture}>
                {children}
            </Element>
        );
    };
};
