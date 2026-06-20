import { createContext, type Key, type ReactElement, type ReactNode, useContext, useRef, useState } from "react";

export interface PresenceState {
    isPresent: boolean;
    onExitComplete: () => void;
}

const PresenceContext = createContext<PresenceState | null>(null);

export const usePresence = (): PresenceState | null => useContext(PresenceContext);

interface KeyedChild {
    key: Key;
    element: ReactElement;
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
