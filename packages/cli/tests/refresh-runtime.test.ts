import RefreshRuntime from "react-refresh/runtime";
import { describe, expect, it } from "vitest";
import {
    createModuleRegistration,
    isRefreshBoundary,
    performRefresh,
    staleExportName,
} from "../src/refresh-runtime.js";

const ES_MODULE_FLAG = "__esModule";

const NullComponent = () => null;

const lowercaseHelper = function lowercaseHelper() {
    return 1;
};

const esModuleExports = (exports: Record<string, unknown>): Record<string, unknown> => ({
    [ES_MODULE_FLAG]: true,
    ...exports,
});

const freshComponent = (): (() => null) => NullComponent.bind(null);

const registerComponent = (moduleId: string, id: string): (() => null) => {
    const component = freshComponent();
    createModuleRegistration(moduleId).$RefreshReg$(component, id);

    return component;
};

const familyCurrent = (type: unknown): unknown => {
    const family = RefreshRuntime.getFamilyByType(type);

    return family === undefined ? null : family.current;
};

describe("createModuleRegistration", () => {
    it("returns registration helpers for a module id", () => {
        const reg = createModuleRegistration("mod-1");
        expect(typeof reg.$RefreshReg$).toBe("function");
        expect(typeof reg.$RefreshSig$).toBe("function");
    });

    it("registers components without throwing", () => {
        const reg = createModuleRegistration("mod-2");

        expect(() => {
            reg.$RefreshReg$(NullComponent, "Component");
        }).not.toThrow();
    });

    it("exposes a $RefreshSig$ signature factory function", () => {
        const reg = createModuleRegistration("mod-3");
        expect(typeof reg.$RefreshSig$).toBe("function");
    });
});

describe("isRefreshBoundary", () => {
    it("returns true when the module value itself is a likely component", () => {
        const Component = Object.assign(
            function MyComponent() {
                return null;
            },
            {} as Record<string, unknown>,
        );

        expect(isRefreshBoundary(Component)).toBe(true);
    });

    it("returns false for a module exporting a non-component value", () => {
        expect(isRefreshBoundary({ value: 42 })).toBe(false);
    });

    it("returns false for an empty exports object", () => {
        expect(isRefreshBoundary({})).toBe(false);
    });

    it("returns false when only the ES module flag is present", () => {
        expect(isRefreshBoundary(esModuleExports({}))).toBe(false);
    });

    it("returns true when all named exports are PascalCase functions", () => {
        expect(
            isRefreshBoundary(esModuleExports({ ComponentA: NullComponent, ComponentB: NullComponent })),
        ).toBe(true);
    });

    it("returns false when any non-component export is present", () => {
        expect(isRefreshBoundary({ Component: NullComponent, helper: () => 1 })).toBe(false);
    });

    it("recognizes React.memo-wrapped components", () => {
        const memoized = { $$typeof: Symbol.for("react.memo"), type: () => null };
        expect(isRefreshBoundary({ wrapped: memoized })).toBe(true);
    });

    it("recognizes React.forwardRef-wrapped components", () => {
        const forwarded = { $$typeof: Symbol.for("react.forward_ref"), render: () => null };
        expect(isRefreshBoundary({ wrapped: forwarded })).toBe(true);
    });

    it("returns false when a non-PascalCase named function is exported", () => {
        expect(isRefreshBoundary({ helper: lowercaseHelper })).toBe(false);
    });
});

describe("staleExportName", () => {
    it("names the export whose component the save re-registered under a different id", () => {
        const previous = registerComponent("mod-stale-1", "Widget");
        const current = registerComponent("mod-stale-1", "Panel");

        expect(staleExportName(esModuleExports({ default: previous }), esModuleExports({ default: current }))).toBe(
            "default",
        );
    });

    it("names nothing when the save re-registered the component under the same id", () => {
        const previous = registerComponent("mod-stale-2", "Widget");
        const current = registerComponent("mod-stale-2", "Widget");

        expect(
            staleExportName(esModuleExports({ Widget: previous }), esModuleExports({ Widget: current })),
        ).toBeNull();
    });

    it("names nothing when the same component is exported under another name", () => {
        const shared = registerComponent("mod-stale-3", "Widget");
        expect(staleExportName(esModuleExports({ Widget: shared }), esModuleExports({ Thing: shared }))).toBeNull();
    });

    it("names an export react-refresh never registered once its value changed", () => {
        const previous = esModuleExports({ Widget: freshComponent() });
        const current = esModuleExports({ Widget: freshComponent() });
        expect(staleExportName(previous, current)).toBe("Widget");
    });

    it("names nothing for a module that exported nothing before the save", () => {
        const current = esModuleExports({ Widget: freshComponent() });
        expect(staleExportName({}, current)).toBeNull();
    });

    it("names nothing when a save re-exports the component it re-exported before", () => {
        const shared = registerComponent("mod-stale-4", "Widget");
        performRefresh();
        expect(staleExportName(esModuleExports({ Widget: shared }), esModuleExports({ Widget: shared }))).toBeNull();
        performRefresh();
        expect(familyCurrent(shared)).toBe(shared);
    });
});

describe("performRefresh", () => {
    it("swaps the family the window renders to the type a save registered under the same id", () => {
        const previous = registerComponent("mod-refresh-1", "Widget");
        performRefresh();
        const current = registerComponent("mod-refresh-1", "Widget");
        performRefresh();
        expect(familyCurrent(previous)).toBe(current);
    });

    it("leaves the window rendering the old type when a save registered its component under a renamed id", () => {
        const previous = registerComponent("mod-refresh-2", "Widget");
        performRefresh();
        const current = registerComponent("mod-refresh-2", "Panel");
        performRefresh();
        expect(familyCurrent(previous)).toBe(previous);
        expect(familyCurrent(current)).toBe(current);
    });
});
