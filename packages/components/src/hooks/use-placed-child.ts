import type * as GObject from "@gtkx/gi/gobject";
import { createPortal, createRootElement, type RootElement } from "@gtkx/react";
import {
    type Context,
    createContext,
    type ReactNode,
    type RefCallback,
    type RefObject,
    useContext,
    useLayoutEffect,
    useRef,
} from "react";

/**
 * A shared off-tree root the positioned-child wrappers render their content
 * into. The reconciler never attaches its children to a live widget, so each
 * wrapper reads its widget back through the render prop's ref and places it
 * imperatively.
 */
export const portalRoot: RootElement = createRootElement();

/**
 * A React context carrying the live parent widget for a family of positioned
 * children, together with the hook that resolves it (throwing when a child is
 * rendered outside its parent).
 */
export type ParentContext<T> = {
    Context: Context<RefObject<T | null> | null>;
    useParentRef: () => RefObject<T | null>;
};

/**
 * Creates a {@link ParentContext} for a container component whose children are
 * declared as a compound subcomponent. `orphanMessage` is thrown when the
 * subcomponent is used without an enclosing provider.
 */
export const createParentContext = <T>(orphanMessage: string): ParentContext<T> => {
    const context = createContext<RefObject<T | null> | null>(null);
    return {
        Context: context,
        useParentRef: (): RefObject<T | null> => {
            const ref = useContext(context);
            if (!ref) throw new Error(orphanMessage);
            return ref;
        },
    };
};

/**
 * Render prop for a positioned child. Receives a ref the caller wires onto the
 * widget it wants placed, so the ref can be routed through the caller's own
 * components rather than assumed to sit on an immediate child.
 */
export type PlacedChildRender<T> = (ref: RefCallback<T>) => ReactNode;

/**
 * Options for {@link usePlacedChild}. `place` runs when the widget first
 * appears or its `placement` changes; `release` detaches it when it leaves or
 * the child unmounts.
 */
export type PlacedChildOptions<T extends GObject.Object, P> = {
    render: PlacedChildRender<T>;
    placement: P;
    samePlacement: (a: P, b: P) => boolean;
    place: (object: T, placement: P, previous: P | undefined) => void;
    release: (object: T) => void;
};

/**
 * Renders a positioned child into an off-tree holder so the reconciler does not
 * parent it, captures the widget through the render prop's ref, and imperatively
 * places it on a parent container — applying `place` on appearance or placement
 * change and `release` on departure or unmount. Shared by the {@link Gtk.Grid}
 * and {@link Gtk.Overlay} wrappers.
 */
export const usePlacedChild = <T extends GObject.Object, P>(options: PlacedChildOptions<T, P>): ReactNode => {
    const { render, placement, samePlacement, place, release } = options;
    const objectRef = useRef<T | null>(null);
    const appliedRef = useRef<{ object: T; placement: P } | null>(null);
    const setObjectRef = useRef<RefCallback<T> | null>(null);
    if (setObjectRef.current === null) {
        setObjectRef.current = (object: T | null): void => {
            objectRef.current = object;
        };
    }

    useLayoutEffect(() => {
        const object = objectRef.current;
        const applied = appliedRef.current;
        if (applied !== null && applied.object !== object) {
            release(applied.object);
            appliedRef.current = null;
        }
        if (object === null) return;
        const current = appliedRef.current;
        if (current === null || !samePlacement(current.placement, placement)) {
            place(object, placement, current?.placement);
            appliedRef.current = { object, placement };
        }
    });

    useLayoutEffect(
        () => () => {
            const applied = appliedRef.current;
            if (applied !== null) release(applied.object);
            appliedRef.current = null;
        },
        [],
    );

    return createPortal(render(setObjectRef.current), portalRoot);
};
