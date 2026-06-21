import {
    createContext,
    type Key,
    type ReactElement,
    type ReactNode,
    useContext,
    useId,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
} from "react";

/**
 * The presence contract exposed to descendants of {@link AnimatePresence} through
 * context. Animated descendants register an id while mounted and report that id
 * complete from their exit "done" callback; the exiting child unmounts only once
 * every registered id has reported complete.
 */
export interface PresenceState {
    /**
     * Whether the subtree is still present in the React tree. `false` means the
     * subtree has been removed but is being kept mounted while it animates out.
     */
    isPresent: boolean;
    /**
     * Report that the animated descendant identified by `id` has finished its exit
     * animation and is safe to remove.
     *
     * @param id - The registration id returned via {@link PresenceState.register}.
     */
    onExitComplete: (id: string) => void;
    /**
     * Register an animated descendant by `id` so the exiting child waits for it to
     * complete before unmounting.
     *
     * @param id - A unique id for the animated descendant.
     * @returns A cleanup callback that unregisters the descendant.
     */
    register: (id: string) => () => void;
}

const PresenceContext = createContext<PresenceState | null>(null);

type UsePresenceResult = [true, null] | [true] | [false, () => void];

const alwaysPresent: [true, null] = [true, null];

/**
 * Reads the {@link PresenceState} from context as a discriminated tuple.
 *
 * Returns `[true, null]` when used outside an {@link AnimatePresence}, `[true]`
 * while present, and `[false, safeToRemove]` while exiting. The `safeToRemove`
 * callback signals the owning {@link AnimatePresence} that this descendant has
 * finished animating out.
 */
export const usePresence = (): UsePresenceResult => {
    const context = useContext(PresenceContext);
    const presenceId = useId();

    useLayoutEffect(() => {
        if (context === null) return;
        return context.register(presenceId);
    }, [context, presenceId]);

    if (context === null) return alwaysPresent;
    if (context.isPresent) return [true];
    return [false, () => context.onExitComplete(presenceId)];
};

interface KeyedChild {
    key: Key;
    element: ReactElement;
}

const warned = new Set<string>();

const warnOnceUnkeyedChild = (): void => {
    if (process.env["NODE_ENV"] === "production") return;
    const message =
        "[gtkx/animate] AnimatePresence received a child without a key; exit animation is disabled for it until a unique key is supplied.";
    if (warned.has(message)) return;
    warned.add(message);
    console.warn(message);
};

/**
 * Extracts the keyed React element children of {@link AnimatePresence}, skipping
 * non-element children. In development a one-time warning is emitted for any
 * element child that is missing a key, since presence tracking requires one.
 *
 * @param children - The children passed to {@link AnimatePresence}.
 * @returns The element children that carry a key, in order.
 */
export const toKeyedChildren = (children: ReactNode): KeyedChild[] => {
    const result: KeyedChild[] = [];
    const childArray = Array.isArray(children) ? children : [children];

    for (const child of childArray) {
        if (child === null || child === undefined || typeof child !== "object") continue;
        const element = child as ReactElement;
        if (element.key === null || element.key === undefined) {
            warnOnceUnkeyedChild();
            continue;
        }
        result.push({ key: element.key, element });
    }

    return result;
};

type PresenceChildProps = {
    isPresent: boolean;
    onExitComplete?: (() => void) | undefined;
    children: ReactNode;
};

const PresenceChild = ({ isPresent, onExitComplete, children }: PresenceChildProps): ReactNode => {
    const registrationsRef = useRef<Map<string, boolean>>(new Map());

    const context = useMemo<PresenceState>(() => {
        const registrations = registrationsRef.current;
        return {
            isPresent,
            onExitComplete: (id: string) => {
                if (!registrations.has(id)) return;
                registrations.set(id, true);
                for (const isComplete of registrations.values()) {
                    if (!isComplete) return;
                }
                onExitComplete?.();
            },
            register: (id: string) => {
                registrations.set(id, false);
                return () => {
                    registrations.delete(id);
                    if (!isPresent && registrations.size === 0) onExitComplete?.();
                };
            },
        };
    }, [isPresent, onExitComplete]);

    useLayoutEffect(() => {
        if (!isPresent && registrationsRef.current.size === 0) onExitComplete?.();
    }, [isPresent, onExitComplete]);

    return <PresenceContext.Provider value={context}>{children}</PresenceContext.Provider>;
};

/**
 * Animates the removal of keyed children from the tree. Children that leave keep
 * rendering until their exit animations complete, at which point they unmount.
 *
 * Every child must carry a unique `key`. The diff between committed and incoming
 * children is computed in a layout effect so the component is safe under React's
 * concurrent and StrictMode rendering.
 *
 * @param props - The component props.
 * @param props.children - The keyed children to track for presence.
 * @returns The present and exiting children wrapped in presence context.
 */
export const AnimatePresence = ({ children }: { children: ReactNode }): ReactNode => {
    const presentChildren = useMemo(() => toKeyedChildren(children), [children]);
    const presentKeys = presentChildren.map((child) => child.key);

    const pendingPresentChildren = useRef(presentChildren);
    const exitComplete = useRef<Map<Key, boolean>>(new Map());

    const [diffedChildren, setDiffedChildren] = useState(presentChildren);
    const [renderedChildren, setRenderedChildren] = useState(presentChildren);

    useLayoutEffect(() => {
        pendingPresentChildren.current = presentChildren;
        for (const child of renderedChildren) {
            if (presentKeys.includes(child.key)) {
                exitComplete.current.delete(child.key);
            } else if (exitComplete.current.get(child.key) !== true) {
                exitComplete.current.set(child.key, false);
            }
        }
    }, [renderedChildren, presentKeys.join("-"), presentChildren]);

    if (presentChildren !== diffedChildren) {
        const nextChildren = [...presentChildren];
        for (let index = 0; index < renderedChildren.length; index += 1) {
            const child = renderedChildren[index];
            if (child && !presentKeys.includes(child.key)) {
                nextChildren.splice(index, 0, child);
            }
        }

        setRenderedChildren(nextChildren);
        setDiffedChildren(presentChildren);
        return null;
    }

    return (
        <>
            {renderedChildren.map((child) => {
                const isPresent = presentKeys.includes(child.key);

                const completeChild = (): void => {
                    if (exitComplete.current.get(child.key) === true) return;
                    exitComplete.current.set(child.key, true);

                    for (const isExitComplete of exitComplete.current.values()) {
                        if (!isExitComplete) return;
                    }

                    exitComplete.current.clear();
                    setRenderedChildren(pendingPresentChildren.current);
                };

                return (
                    <PresenceChild
                        key={child.key}
                        isPresent={isPresent}
                        onExitComplete={isPresent ? undefined : completeChild}
                    >
                        {child.element}
                    </PresenceChild>
                );
            })}
        </>
    );
};
