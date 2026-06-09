import { createContext, type Key, type ReactElement, type ReactNode, useContext, useRef, useState } from "react";

/**
 * Presence state shared from {@link AnimatePresence} to a single keyed child.
 *
 * A child reads `isPresent` to learn whether it is still in the live tree or is
 * being held mounted for an exit animation, and calls `onExitComplete` once its
 * exit animation finishes so the boundary can remove it.
 */
export interface PresenceState {
    /** `false` while the child is exiting and held mounted for its exit animation. */
    readonly isPresent: boolean;
    /** Signals the boundary that the exit animation has finished and the child may unmount. */
    readonly onExitComplete: () => void;
}

const PresenceContext = createContext<PresenceState | null>(null);

/**
 * Reads the enclosing {@link AnimatePresence} presence state.
 *
 * Returns `null` when the component is not wrapped in an `<AnimatePresence>`, in
 * which case the component is always present and exit animations do not run.
 *
 * @returns The presence state, or `null` outside an `<AnimatePresence>`.
 */
export const usePresence = (): PresenceState | null => useContext(PresenceContext);

interface KeyedChild {
    readonly key: Key;
    readonly element: ReactElement;
}

const toKeyedChildren = (children: ReactNode): KeyedChild[] => {
    const result: KeyedChild[] = [];
    const childArray = Array.isArray(children) ? children : [children];

    for (const child of childArray) {
        if (child === null || child === undefined || typeof child !== "object") continue;
        const element = child as ReactElement;
        if (element.key === null || element.key === undefined) continue;
        result.push({ key: element.key, element });
    }

    return result;
};

/**
 * Holds exiting children mounted until their exit animation completes.
 *
 * React unmounts a removed element synchronously, which destroys its widget
 * before any exit animation could play. `AnimatePresence` snapshots its keyed
 * children and, when a key disappears from the new children, keeps rendering the
 * previous element with `isPresent` set to `false` until that child reports its
 * exit animation done through {@link PresenceState.onExitComplete}, after which
 * the element is dropped.
 *
 * Every direct child must carry a stable `key`. Children without a key are
 * rendered but never deferred on exit.
 *
 * @example
 * ```tsx
 * <AnimatePresence>
 *   {show && (
 *     <AdwTimedAnimation key="card" animate={{ opacity: 1 }} exit={{ opacity: 0 }} animateOnMount>
 *       <GtkLabel label="Fading" />
 *     </AdwTimedAnimation>
 *   )}
 * </AnimatePresence>
 * ```
 *
 * @param props - The presence boundary's keyed children.
 * @returns The live children plus any children still playing their exit animation.
 */
export const AnimatePresence = ({ children }: { children: ReactNode }): ReactNode => {
    const present = toKeyedChildren(children);
    const presentKeys = new Set(present.map((child) => child.key));

    const renderedRef = useRef<KeyedChild[]>(present);
    const exitingRef = useRef<Map<Key, ReactElement>>(new Map());
    const [, forceRender] = useState(0);

    for (const child of renderedRef.current) {
        if (!presentKeys.has(child.key) && !exitingRef.current.has(child.key)) {
            exitingRef.current.set(child.key, child.element);
        }
    }

    for (const key of exitingRef.current.keys()) {
        if (presentKeys.has(key)) {
            exitingRef.current.delete(key);
        }
    }

    renderedRef.current = present;

    const completeExit = (key: Key): void => {
        if (exitingRef.current.delete(key)) {
            forceRender((tick) => tick + 1);
        }
    };

    const exiting: KeyedChild[] = [];
    for (const [key, element] of exitingRef.current) {
        exiting.push({ key, element });
    }

    return (
        <>
            {present.map((child) => (
                <PresenceContext.Provider key={child.key} value={{ isPresent: true, onExitComplete: () => {} }}>
                    {child.element}
                </PresenceContext.Provider>
            ))}
            {exiting.map((child) => (
                <PresenceContext.Provider
                    key={child.key}
                    value={{ isPresent: false, onExitComplete: () => completeExit(child.key) }}
                >
                    {child.element}
                </PresenceContext.Provider>
            ))}
        </>
    );
};
