import RefreshRuntime from "react-refresh/runtime";

type ComponentType = (...args: unknown[]) => unknown;

const identity = (type: unknown): unknown => type;

RefreshRuntime.injectIntoGlobalHook(globalThis);
globalThis.$RefreshReg$ = () => {};
globalThis.$RefreshSig$ = () => identity;

/**
 * Builds the per-module `$RefreshReg$` and `$RefreshSig$` hooks that React Refresh
 * transformed code expects, scoping every registered component to the given module.
 *
 * @param moduleId Identifier used to namespace registered component types so they are unique across modules.
 * @returns An object with `$RefreshReg$` and `$RefreshSig$` to install as module-local globals.
 */
export function createModuleRegistration(moduleId: string): {
    $RefreshReg$: (type: ComponentType, id: string) => void;
    $RefreshSig$: typeof RefreshRuntime.createSignatureFunctionForTransform;
} {
    return {
        $RefreshReg$: (type: ComponentType, id: string) => {
            RefreshRuntime.register(type, `${moduleId} ${id}`);
        },
        $RefreshSig$: RefreshRuntime.createSignatureFunctionForTransform,
    };
}

/**
 * Determines whether a module can act as a React Refresh boundary, meaning every one of
 * its exports (ignoring `__esModule`) looks like a React component type.
 *
 * @param moduleExports The module's export object to inspect.
 * @returns `true` when the module qualifies as a refresh boundary, `false` otherwise.
 */
const isComponentExport = (key: string, value: unknown): boolean =>
    key === "__esModule" || RefreshRuntime.isLikelyComponentType(value);

const everyExportIsComponent = (moduleExports: Record<string, unknown>): boolean => {
    for (const key in moduleExports) {
        if (!isComponentExport(key, moduleExports[key])) return false;
    }
    return true;
};

export function isRefreshBoundary(moduleExports: Record<string, unknown>): boolean {
    if (RefreshRuntime.isLikelyComponentType(moduleExports)) {
        return true;
    }

    if (!everyExportIsComponent(moduleExports)) {
        return false;
    }

    return Object.keys(moduleExports).some((k) => k !== "__esModule");
}

/**
 * Applies all pending React Refresh updates, re-rendering components whose modules have changed.
 */
export function performRefresh(): void {
    RefreshRuntime.performReactRefresh();
}
