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

interface PresenceContextProps {
    isPresent: boolean;
    initial: boolean;
    onExitComplete: (id: string) => void;
    register: (id: string) => () => void;
}

const PresenceContext = createContext<PresenceContextProps | null>(null);

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

export const usePresenceInitial = (): boolean => {
    const context = useContext(PresenceContext);
    return context === null ? true : context.initial;
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

export const onlyKeyedElements = (children: ReactNode): KeyedChild[] => {
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
    initial: boolean;
    onExitComplete?: (() => void) | undefined;
    children: ReactNode;
};

const PresenceChild = ({ isPresent, initial, onExitComplete, children }: PresenceChildProps): ReactNode => {
    const registrationsRef = useRef<Map<string, boolean>>(new Map());

    const context = useMemo<PresenceContextProps>(() => {
        const registrations = registrationsRef.current;
        return {
            isPresent,
            initial,
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
    }, [isPresent, initial, onExitComplete]);

    useLayoutEffect(() => {
        if (!isPresent && registrationsRef.current.size === 0) onExitComplete?.();
    }, [isPresent, onExitComplete]);

    return <PresenceContext.Provider value={context}>{children}</PresenceContext.Provider>;
};

const mergeExitingChildren = (
    presentChildren: KeyedChild[],
    renderedChildren: KeyedChild[],
    presentKeys: Key[],
): KeyedChild[] => {
    const nextChildren = [...presentChildren];
    for (let index = 0; index < renderedChildren.length; index += 1) {
        const child = renderedChildren[index];
        if (child && !presentKeys.includes(child.key)) {
            nextChildren.splice(index, 0, child);
        }
    }
    return nextChildren;
};

type ExitContext = {
    key: Key;
    exitComplete: Map<Key, boolean>;
    pending: KeyedChild[];
    commit: (children: KeyedChild[]) => void;
};

const completeExit = (context: ExitContext): void => {
    if (context.exitComplete.get(context.key) === true) return;
    context.exitComplete.set(context.key, true);
    for (const isExitComplete of context.exitComplete.values()) {
        if (!isExitComplete) return;
    }
    context.exitComplete.clear();
    context.commit(context.pending);
};

export const AnimatePresence = ({
    children,
    initial = true,
}: {
    children: ReactNode;
    initial?: boolean;
}): ReactNode => {
    const presentChildren = useMemo(() => onlyKeyedElements(children), [children]);
    const presentKeys = presentChildren.map((child) => child.key);

    const isInitialRender = useRef(true);
    const pendingPresentChildren = useRef(presentChildren);
    const exitComplete = useRef<Map<Key, boolean>>(new Map());

    const [diffedChildren, setDiffedChildren] = useState(presentChildren);
    const [renderedChildren, setRenderedChildren] = useState(presentChildren);

    const presenceInitial = isInitialRender.current ? initial : true;

    useLayoutEffect(() => {
        isInitialRender.current = false;
    }, []);

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
        setRenderedChildren(mergeExitingChildren(presentChildren, renderedChildren, presentKeys));
        setDiffedChildren(presentChildren);
        return null;
    }

    return (
        <>
            {renderedChildren.map((child) => {
                const isPresent = presentKeys.includes(child.key);
                const onExitComplete = isPresent
                    ? undefined
                    : () =>
                          completeExit({
                              key: child.key,
                              exitComplete: exitComplete.current,
                              pending: pendingPresentChildren.current,
                              commit: setRenderedChildren,
                          });
                return (
                    <PresenceChild
                        key={child.key}
                        isPresent={isPresent}
                        initial={presenceInitial}
                        onExitComplete={onExitComplete}
                    >
                        {child.element}
                    </PresenceChild>
                );
            })}
        </>
    );
};
