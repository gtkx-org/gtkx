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

export interface PresenceState {
    isPresent: boolean;
    onExitComplete: (id: string) => void;
    register: (id: string) => () => void;
}

const PresenceContext = createContext<PresenceState | null>(null);

type UsePresenceResult = [true, null] | [true] | [false, () => void];

const alwaysPresent: [true, null] = [true, null];

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
