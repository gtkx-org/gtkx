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

export const portalRoot: RootElement = createRootElement();

export type ParentContext<T> = {
    Context: Context<RefObject<T | null> | null>;
    useParentRef: () => RefObject<T | null>;
};

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

export type PlacedChildRender<T> = (ref: RefCallback<T>) => ReactNode;

export type PlacedChildOptions<T extends GObject.Object, P> = {
    render: PlacedChildRender<T>;
    placement: P;
    samePlacement: (a: P, b: P) => boolean;
    place: (object: T, placement: P, previous: P | undefined) => void;
    release: (object: T) => void;
};

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
