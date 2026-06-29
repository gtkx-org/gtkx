import {
    Children,
    createContext,
    isValidElement,
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

export const useIsInitialPresence = (): boolean => {
    const context = useContext(PresenceContext);
    return context === null ? true : context.initial;
};

const warned = new Set<string>();

const warnOnceUnkeyedChild = (): void => {
    if (process.env.NODE_ENV === "production") return;
    const message =
        "[gtkx/animate] AnimatePresence received a child without a key; exit animation is disabled for it until a unique key is supplied.";
    if (warned.has(message)) return;
    warned.add(message);
    console.warn(message);
};

export const onlyElements = (children: ReactNode): ReactElement[] => {
    const result: ReactElement[] = [];

    Children.forEach(children, (child) => {
        if (!isValidElement(child)) return;
        if (child.key === null || child.key === undefined) {
            warnOnceUnkeyedChild();
            return;
        }
        result.push(child);
    });

    return result;
};

export const getChildKey = (child: ReactElement): Key => {
    if (child.key === null) {
        throw new Error("[gtkx/animate] AnimatePresence child is missing a key; onlyElements should have filtered it.");
    }
    return child.key;
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
    presentChildren: ReactElement[],
    renderedChildren: ReactElement[],
    presentKeys: Key[],
): ReactElement[] => {
    const nextChildren = [...presentChildren];
    for (let index = 0; index < renderedChildren.length; index += 1) {
        const child = renderedChildren[index];
        if (child && !presentKeys.includes(getChildKey(child))) {
            nextChildren.splice(index, 0, child);
        }
    }
    return nextChildren;
};

type ExitContext = {
    key: Key;
    exitComplete: Map<Key, boolean>;
    pending: ReactElement[];
    commit: (children: ReactElement[]) => void;
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
    const presentChildren = useMemo(() => onlyElements(children), [children]);
    const presentKeys = presentChildren.map(getChildKey);

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
            const childKey = getChildKey(child);
            if (presentKeys.includes(childKey)) {
                exitComplete.current.delete(childKey);
            } else if (exitComplete.current.get(childKey) !== true) {
                exitComplete.current.set(childKey, false);
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
                const childKey = getChildKey(child);
                const isPresent = presentKeys.includes(childKey);
                const onExitComplete = isPresent
                    ? undefined
                    : () =>
                          completeExit({
                              key: childKey,
                              exitComplete: exitComplete.current,
                              pending: pendingPresentChildren.current,
                              commit: setRenderedChildren,
                          });
                return (
                    <PresenceChild
                        key={childKey}
                        isPresent={isPresent}
                        initial={presenceInitial}
                        onExitComplete={onExitComplete}
                    >
                        {child}
                    </PresenceChild>
                );
            })}
        </>
    );
};
