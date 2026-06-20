import RefreshRuntime from "react-refresh/runtime";

type ComponentType = (...args: unknown[]) => unknown;

RefreshRuntime.injectIntoGlobalHook(globalThis);
globalThis.$RefreshReg$ = () => {};
globalThis.$RefreshSig$ = () => (type: unknown) => type;

/**
 * Creates registration functions for a module's React components.
 *
 * Used internally by the Vite plugin to register components
 * for React Fast Refresh.
 *
 * @param moduleId - Unique identifier for the module
 * @returns Registration functions for the module
 * @internal
 */
export function createModuleRegistration(moduleId: string): {
    // biome-ignore lint/style/useNamingConvention: React Fast Refresh runtime global, name fixed by the React refresh API
    $RefreshReg$: (type: ComponentType, id: string) => void;
    // biome-ignore lint/style/useNamingConvention: React Fast Refresh runtime global, name fixed by the React refresh API
    $RefreshSig$: typeof RefreshRuntime.createSignatureFunctionForTransform;
} {
    return {
        // biome-ignore lint/style/useNamingConvention: React Fast Refresh runtime global, name fixed by the React refresh API
        $RefreshReg$: (type: ComponentType, id: string) => {
            RefreshRuntime.register(type, `${moduleId} ${id}`);
        },
        // biome-ignore lint/style/useNamingConvention: React Fast Refresh runtime global, name fixed by the React refresh API
        $RefreshSig$: RefreshRuntime.createSignatureFunctionForTransform,
    };
}

/**
 * Checks if a module's exports form a React Refresh boundary.
 *
 * A module is a refresh boundary if all its exports are React components,
 * allowing for fast refresh without full page reload.
 *
 * @param moduleExports - The module's exports object
 * @returns `true` if the module can be fast-refreshed
 * @internal
 */
export function isReactRefreshBoundary(moduleExports: Record<string, unknown>): boolean {
    if (RefreshRuntime.isLikelyComponentType(moduleExports)) {
        return true;
    }

    for (const key in moduleExports) {
        if (key === "__esModule") {
            continue;
        }

        const value = moduleExports[key];

        if (!RefreshRuntime.isLikelyComponentType(value)) {
            return false;
        }
    }

    return Object.keys(moduleExports).some((k) => k !== "__esModule");
}

/**
 * Triggers React Fast Refresh to re-render components.
 *
 * Called after module updates when all exports are React components.
 *
 * @internal
 */
export function performRefresh(): void {
    RefreshRuntime.performReactRefresh();
}
