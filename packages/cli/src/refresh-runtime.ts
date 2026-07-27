import RefreshRuntime from "react-refresh/runtime";
import "./refresh-globals.js";

type ComponentType = (...args: unknown[]) => unknown;

/**
 * Builds the per-module `$RefreshReg$` and `$RefreshSig$` hooks that React Refresh
 * transformed code expects, scoping every registered component to the given module.
 *
 * @param moduleId Identifier used to namespace registered component types so they are unique across modules.
 * @returns An object with `$RefreshReg$` and `$RefreshSig$` to install as module-local globals.
 */
function createModuleRegistration(moduleId: string): {
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

const areAllExportsComponents = (moduleExports: Record<string, unknown>): boolean => {
    for (const key in moduleExports) {
        if (!isComponentExport(key, moduleExports[key])) {
            return false;
        }
    }

    return true;
};

function isRefreshBoundary(moduleExports: Record<string, unknown>): boolean {
    if (RefreshRuntime.isLikelyComponentType(moduleExports)) {
        return true;
    }

    if (!areAllExportsComponents(moduleExports)) {
        return false;
    }

    return Object.keys(moduleExports).some((k) => k !== "__esModule");
}

/**
 * Applies all pending React Refresh updates, re-rendering components whose modules have changed.
 */
function performRefresh(): void {
    RefreshRuntime.performReactRefresh();
}

export { createModuleRegistration, isRefreshBoundary, performRefresh };
