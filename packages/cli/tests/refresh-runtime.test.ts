import { describe, expect, it } from "vitest";
import { createModuleRegistration, isRefreshBoundary, performRefresh } from "../src/refresh-runtime.js";

describe("createModuleRegistration", () => {
    it("returns registration helpers for a module id", () => {
        const reg = createModuleRegistration("mod-1");
        expect(typeof reg.$RefreshReg$).toBe("function");
        expect(typeof reg.$RefreshSig$).toBe("function");
    });

    it("registers components without throwing", () => {
        const reg = createModuleRegistration("mod-2");
        const Component = () => null;
        expect(() => reg.$RefreshReg$(Component, "Component")).not.toThrow();
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

    it("returns false when only __esModule is present", () => {
        expect(isRefreshBoundary({ __esModule: true })).toBe(false);
    });

    it("returns true when all named exports are PascalCase functions", () => {
        const ComponentA = () => null;
        const ComponentB = () => null;
        expect(isRefreshBoundary({ __esModule: true, ComponentA, ComponentB })).toBe(true);
    });

    it("returns false when any non-component export is present", () => {
        const Component = () => null;
        expect(isRefreshBoundary({ Component, helper: () => 1 })).toBe(false);
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
        const helper = function lowercaseHelper() {
            return 1;
        };
        expect(isRefreshBoundary({ helper })).toBe(false);
    });
});

describe("performRefresh", () => {
    it("does not throw when invoked", () => {
        expect(() => performRefresh()).not.toThrow();
    });
});
