import RefreshRuntime from "react-refresh/runtime";

type ComponentType = (...args: unknown[]) => unknown;

RefreshRuntime.injectIntoGlobalHook(globalThis);
globalThis.$RefreshReg$ = () => {};
globalThis.$RefreshSig$ = () => (type: unknown) => type;

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

export function performRefresh(): void {
    RefreshRuntime.performReactRefresh();
}
