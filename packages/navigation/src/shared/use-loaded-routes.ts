import { useState } from "react";

const useLoadedRoutes = (focusedKey: string, preloadedKeys: readonly string[]): ReadonlySet<string> => {
    const [loaded, setLoaded] = useState<ReadonlySet<string>>(() => new Set([focusedKey]));
    const pending = [focusedKey, ...preloadedKeys].filter((key) => !loaded.has(key));

    if (pending.length > 0) {
        setLoaded(new Set([...loaded, ...pending]));
    }

    return loaded;
};

export { useLoadedRoutes };
