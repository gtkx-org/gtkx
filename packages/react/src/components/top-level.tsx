import * as Gtk from "@gtkx/gi/gtk";
import {
    createContext,
    type ElementType,
    type ReactNode,
    type Ref,
    useContext,
    useLayoutEffect,
    useRef,
    useState,
} from "react";
import { type AdwDialogLike, isAdwDialog } from "../gtype-predicates.js";
import { assignRef } from "../use-merged-refs.js";

/** A top-level surface: a window or an Adwaita dialog. */
type Surface = Gtk.Window | AdwDialogLike;

/**
 * The nearest enclosing window. A child window reads it to set its transient-for
 * relationship; an `Adw.Dialog` presents against it. Each window component
 * provides itself to its subtree.
 */
export const WindowContext = createContext<Gtk.Window | null>(null);

/**
 * Presents `surface` and returns its teardown. A window is shown with
 * `present()` (transient for its enclosing window) and torn down with
 * `destroy()` after its default widget is cleared — a `Gtk.Window` holds its
 * default widget as a borrowed back-pointer GObject finalization could leave
 * dangling, so resetting it synchronously while still alive is required. An
 * `Adw.Dialog` is presented against its parent window and force-closed.
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
 * through a callback ref, presents it once mounted, tears it down on unmount,
 * and exposes the window its subtree should observe through {@link WindowContext}.
 *
 * @typeParam T - The concrete surface type the wrapped element backs.
 * @param externalRef - A caller ref to forward the surface to, or `undefined`.
 * @returns The capture ref to bind to the surface element and the window value
 *   its descendants observe.
 */
export const useTopLevelSurface = <T extends Surface>(
    externalRef: Ref<T | null> | undefined,
): { capture: (instance: T | null) => void; childWindow: Gtk.Window | null } => {
    const [surface, setSurface] = useState<Surface | null>(null);
    const parent = useContext(WindowContext);
    const parentRef = useRef(parent);
    parentRef.current = parent;

    useLayoutEffect(() => {
        if (!surface) return;
        return presentSurface(surface, parentRef.current);
    }, [surface]);

    useLayoutEffect(() => {
        if (surface instanceof Gtk.Window && parent) surface.setTransientFor(parent);
    }, [surface, parent]);

    const capture = (instance: T | null): void => {
        setSurface(instance);
        assignRef(externalRef, instance);
    };

    return { capture, childWindow: surface instanceof Gtk.Window ? surface : parent };
};

/**
 * Wraps a top-level surface element (a window/dialog intrinsic or its slotted
 * compound) into a component that presents the surface on mount, tears it down
 * on unmount, and provides its window to descendants through {@link WindowContext}.
 * Construct-only props and slot props pass straight through to the underlying
 * element; the caller's `ref` still receives the backing surface.
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
        const { capture, childWindow } = useTopLevelSurface(externalRef);
        const { children, ...rest } = props;
        return (
            <Element {...rest} ref={capture}>
                <WindowContext.Provider value={childWindow}>{children}</WindowContext.Provider>
            </Element>
        );
    };
};
