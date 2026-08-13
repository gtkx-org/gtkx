import RefreshRuntime from "react-refresh/runtime";
import "./refresh-globals.js";

type ComponentType = (...args: unknown[]) => unknown;
type ExportSignature = Map<string, boolean>;

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

const exportSignature = (moduleExports: Record<string, unknown>): ExportSignature => {
    const signature: ExportSignature = new Map();

    for (const key in moduleExports) {
        signature.set(key, isComponentExport(key, moduleExports[key]));
    }

    return signature;
};

function performRefresh(): void {
    RefreshRuntime.performReactRefresh();
}

export { createModuleRegistration, exportSignature, type ExportSignature, isRefreshBoundary, performRefresh };
