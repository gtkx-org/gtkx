import RefreshRuntime from "react-refresh/runtime";

const identity = (type: unknown): unknown => type;

RefreshRuntime.injectIntoGlobalHook(globalThis);

Object.assign(globalThis, {
    $RefreshReg$: () => {},
    $RefreshSig$: () => identity,
});
