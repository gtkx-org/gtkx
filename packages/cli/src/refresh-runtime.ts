import RefreshRuntime, { type Family } from "react-refresh/runtime";
import "./refresh-globals.js";

type ComponentType = (...args: unknown[]) => unknown;

type PatchedExports = {
    values: Set<unknown>;
    families: Set<Family>;
};

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

const exportedFamilies = (moduleExports: Record<string, unknown>): Set<Family> => {
    const families: Set<Family> = new Set();

    for (const key in moduleExports) {
        const family = RefreshRuntime.getFamilyByType(moduleExports[key]);

        if (family) {
            families.add(family);
        }
    }

    return families;
};

const patchedExports = (moduleExports: Record<string, unknown>): PatchedExports => ({
    values: new Set(Object.values(moduleExports)),
    families: exportedFamilies(moduleExports),
});

const isPatchedExport = (patched: PatchedExports, value: unknown): boolean => {
    if (patched.values.has(value)) {
        return true;
    }

    const family = RefreshRuntime.getFamilyByType(value);

    return family !== undefined && patched.families.has(family);
};

const staleExportName = (previous: Record<string, unknown>, current: Record<string, unknown>): string | null => {
    const patched = patchedExports(current);

    for (const key in previous) {
        if (!isPatchedExport(patched, previous[key])) {
            return key;
        }
    }

    return null;
};

function performRefresh(): void {
    RefreshRuntime.performReactRefresh();
}

export { createModuleRegistration, isRefreshBoundary, performRefresh, staleExportName };
