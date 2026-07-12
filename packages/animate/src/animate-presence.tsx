import { createLogger } from "@gtkx/utils";
import {
    Children,
    createContext,
    isValidElement,
    type Key,
    type ReactElement,
    type ReactNode,
    type RefObject,
    useContext,
    useId,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
} from "react";

const log = createLogger("animate");

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
    }, [presenceId]);

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
        "AnimatePresence received a child without a key; exit animation is disabled for it until a unique key is supplied.";
    if (warned.has(message)) return;
    warned.add(message);
    log.warn(message);
};

export const onlyElements = (children: ReactNode): ReactElement[] => {
    const result: ReactElement[] = [];

    Children.forEach(children, (child) => {
        if (!isValidElement(child)) return;
        if (child.key === null) {
            warnOnceUnkeyedChild();
            return;
        }
        result.push(child);
    });

    return result;
};

export const getChildKey = (child: ReactElement): Key => {
    if (child.key === null) {
        throw new Error("[gtkx] AnimatePresence child is missing a key; onlyElements should have filtered it.");
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
    const isPresentRef = useRef(isPresent);
    const onExitCompleteRef = useRef(onExitComplete);

    useLayoutEffect(() => {
        isPresentRef.current = isPresent;
        onExitCompleteRef.current = onExitComplete;
    });

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
                onExitCompleteRef.current?.();
            },
            register: (id: string) => {
                registrations.set(id, false);
                return () => {
                    registrations.delete(id);
                    if (!isPresentRef.current && registrations.size === 0) onExitCompleteRef.current?.();
                };
            },
        };
    }, [isPresent, initial]);

    useLayoutEffect(() => {
        if (!isPresent && registrationsRef.current.size === 0) onExitComplete?.();
    }, [isPresent, onExitComplete]);

    return <PresenceContext.Provider value={context}>{children}</PresenceContext.Provider>;
};

const exitingChildrenOf = (renderedChildren: ReactElement[], presentKeys: Key[]): ReactElement[] =>
    renderedChildren.filter((child) => !presentKeys.includes(getChildKey(child)));

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
    exitingComponents: Set<Key>;
    pending: ReactElement[];
    commit: (children: ReactElement[]) => void;
    onAllComplete?: (() => void) | undefined;
};

const completeExit = (context: ExitContext): void => {
    if (context.exitingComponents.has(context.key)) return;
    if (!context.exitComplete.has(context.key)) return;

    context.exitingComponents.add(context.key);
    context.exitComplete.set(context.key, true);

    for (const isExitComplete of context.exitComplete.values()) {
        if (!isExitComplete) return;
    }

    context.exitComplete.clear();
    context.exitingComponents.clear();
    context.commit(context.pending);
    context.onAllComplete?.();
};

const syncExitTracking = (
    renderedChildren: ReactElement[],
    presentKeys: Key[],
    exitComplete: Map<Key, boolean>,
    exitingComponents: Set<Key>,
): void => {
    for (const child of renderedChildren) {
        const childKey = getChildKey(child);
        if (presentKeys.includes(childKey)) {
            exitComplete.delete(childKey);
            exitingComponents.delete(childKey);
        } else if (exitComplete.get(childKey) !== true) {
            exitComplete.set(childKey, false);
        }
    }
};

type RenderPresenceParams = {
    renderedChildren: ReactElement[];
    presentKeys: Key[];
    presenceInitial: boolean;
    exitComplete: Map<Key, boolean>;
    exitingComponents: Set<Key>;
    pendingPresentChildren: RefObject<ReactElement[]>;
    commit: (children: ReactElement[]) => void;
    onAllComplete?: (() => void) | undefined;
};

const renderPresenceChildren = (params: RenderPresenceParams): ReactNode =>
    params.renderedChildren.map((child) => {
        const childKey = getChildKey(child);
        const isPresent = params.presentKeys.includes(childKey);
        const onExitComplete = isPresent
            ? undefined
            : () =>
                  completeExit({
                      key: childKey,
                      exitComplete: params.exitComplete,
                      exitingComponents: params.exitingComponents,
                      pending: params.pendingPresentChildren.current,
                      commit: params.commit,
                      onAllComplete: params.onAllComplete,
                  });
        return (
            <PresenceChild
                key={childKey}
                isPresent={isPresent}
                initial={params.presenceInitial}
                onExitComplete={onExitComplete}
            >
                {child}
            </PresenceChild>
        );
    });

/**
 * Controls how entering and exiting children overlap: `sync` animates them at the same time,
 * while `wait` finishes the exit animations before entering children mount.
 */
export type AnimatePresenceMode = "sync" | "wait";

/** Props for {@link AnimatePresence}. */
export type AnimatePresenceProps = {
    children: ReactNode;
    /** Whether children present on the first render run their enter animations. */
    initial?: boolean;
    /** How entering and exiting children overlap. */
    mode?: AnimatePresenceMode;
    /** Called once every exiting child has finished its exit animation. */
    onExitComplete?: () => void;
};

/**
 * Keeps removed children mounted until their exit animations finish, enabling exit animations for
 * keyed children as they are added to and removed from its subtree. Each child must have a stable
 * unique `key`.
 */
export const AnimatePresence = ({
    children,
    initial = true,
    mode = "sync",
    onExitComplete,
}: AnimatePresenceProps): ReactNode => {
    const presentChildren = useMemo(() => onlyElements(children), [children]);
    const presentKeys = presentChildren.map(getChildKey);

    const isInitialRender = useRef(true);
    const pendingPresentChildren = useRef(presentChildren);
    const exitComplete = useRef<Map<Key, boolean>>(new Map());
    const exitingComponents = useRef<Set<Key>>(new Set());

    const [diffedChildren, setDiffedChildren] = useState(presentChildren);
    const [renderedChildren, setRenderedChildren] = useState(presentChildren);

    const presenceInitial = isInitialRender.current ? initial : true;

    useLayoutEffect(() => {
        isInitialRender.current = false;
    }, []);

    useLayoutEffect(() => {
        pendingPresentChildren.current = presentChildren;
        syncExitTracking(renderedChildren, presentKeys, exitComplete.current, exitingComponents.current);
    }, [renderedChildren, presentKeys.join("-"), presentChildren]);

    if (presentChildren !== diffedChildren) {
        const exiting = exitingChildrenOf(renderedChildren, presentKeys);
        const nextChildren =
            mode === "wait" && exiting.length > 0
                ? exiting
                : mergeExitingChildren(presentChildren, renderedChildren, presentKeys);
        setRenderedChildren(nextChildren);
        setDiffedChildren(presentChildren);
        return null;
    }

    return (
        <>
            {renderPresenceChildren({
                renderedChildren,
                presentKeys,
                presenceInitial,
                exitComplete: exitComplete.current,
                exitingComponents: exitingComponents.current,
                pendingPresentChildren,
                commit: setRenderedChildren,
                onAllComplete: onExitComplete,
            })}
        </>
    );
};
