/**
 * Generates the private presence runtime shared by generated GTK wrappers and
 * GTKX animation components.
 */
export const generatePresence = (): string => `import {
    Children,
    createContext,
    type Key,
    type ReactElement,
    type ReactNode,
    isValidElement,
    useContext,
    useRef,
    useState,
} from "react";

/** @internal Marker set on animation components that can complete deferred exits. */
export const PRESENCE_CHILD_MARKER = "__gtkxPresenceChild" as const;

/** @internal Presence state shared with an animation component during exit. */
export interface PresenceState {
    /** Whether the child still belongs to the live React tree. */
    readonly isPresent: boolean;
    /** Signals that the deferred exit has completed. */
    readonly onExitComplete: () => void;
}

/** @internal Component type marker read by the automatic presence boundary. */
export type PresenceChildComponent = {
    readonly [PRESENCE_CHILD_MARKER]?: true;
};

const PresenceContext = createContext<PresenceState | null>(null);

const noop = (): void => {};

const PRESENT_STATE: PresenceState = { isPresent: true, onExitComplete: noop };

interface KeyedChild {
    readonly key: Key;
    readonly element: ReactElement;
}

const isPresenceChildType = (type: unknown): boolean =>
    typeof type === "function" && (type as PresenceChildComponent)[PRESENCE_CHILD_MARKER] === true;

const toKeyedPresenceChild = (child: ReactNode): KeyedChild | null => {
    if (!isValidElement<{ readonly exit?: unknown }>(child)) return null;
    if (!isPresenceChildType(child.type)) return null;
    if (child.props.exit == null) return null;
    const key = child.key;
    if (key == null) return null;
    return { key, element: child };
};

const toKeyedPresenceChildren = (children: ReactNode): KeyedChild[] => {
    const result: KeyedChild[] = [];
    Children.forEach(children, (child) => {
        const keyed = toKeyedPresenceChild(child);
        if (keyed) result.push(keyed);
    });
    return result;
};

const toLiveKeys = (children: ReactNode): Set<Key> => {
    const keys = new Set<Key>();
    Children.forEach(children, (child) => {
        if (!isValidElement(child)) return;
        const key = child.key;
        if (key != null) keys.add(key);
    });
    return keys;
};

/**
 * @internal
 * Reads the nearest automatic presence boundary state.
 *
 * @returns The current presence state, or \`null\` outside the generated boundary.
 */
export const usePresence = (): PresenceState | null => useContext(PresenceContext);

/**
 * @internal
 * Keeps direct keyed animation children mounted until their exit animation ends.
 *
 * @param props - The generated component children to render.
 * @returns The live children plus direct exiting animation children.
 */
export const AutoAnimatePresence = ({ children }: { children?: ReactNode }): ReactNode => {
    const present = toKeyedPresenceChildren(children);
    const liveKeys = toLiveKeys(children);

    const renderedRef = useRef<KeyedChild[]>(present);
    const exitingRef = useRef<Map<Key, ReactElement>>(new Map());
    const [, forceRender] = useState(0);

    for (const child of renderedRef.current) {
        if (!liveKeys.has(child.key) && !exitingRef.current.has(child.key)) {
            exitingRef.current.set(child.key, child.element);
        }
    }

    for (const key of exitingRef.current.keys()) {
        if (liveKeys.has(key)) {
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
            <PresenceContext.Provider value={PRESENT_STATE}>{children}</PresenceContext.Provider>
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
`;
