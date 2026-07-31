import RefreshRuntime from "react-refresh/runtime";
import "./refresh-globals.js";

type ComponentType = (...args: unknown[]) => unknown;

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

function performRefresh(): void {
    RefreshRuntime.performReactRefresh();
}

export { createModuleRegistration, isRefreshBoundary, performRefresh };
