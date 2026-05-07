import { describe, expect, it } from "vitest";
import { createModuleRegistration, isReactRefreshBoundary, performRefresh } from "../src/refresh-runtime.js";

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

describe("isReactRefreshBoundary", () => {
    it("returns true when the module value itself is a likely component", () => {
        const Component = function MyComponent() {
            return null;
        };
        expect(isReactRefreshBoundary(Component as unknown as Record<string, unknown>)).toBe(true);
    });

    it("returns false for a module exporting a non-component value", () => {
        expect(isReactRefreshBoundary({ value: 42 })).toBe(false);
    });

    it("returns false for an empty exports object", () => {
        expect(isReactRefreshBoundary({})).toBe(false);
    });

    it("returns false when only __esModule is present", () => {
        expect(isReactRefreshBoundary({ __esModule: true })).toBe(false);
    });

    it("returns true when all named exports are PascalCase functions", () => {
        const ComponentA = () => null;
        const ComponentB = () => null;
        expect(isReactRefreshBoundary({ __esModule: true, ComponentA, ComponentB })).toBe(true);
    });

    it("returns false when any non-component export is present", () => {
        const Component = () => null;
        expect(isReactRefreshBoundary({ Component, helper: () => 1 })).toBe(false);
    });

    it("recognizes React.memo-wrapped components", () => {
        const memoised = (() => null) as { (): null; $$typeof?: symbol };
        memoised.$$typeof = Symbol.for("react.memo");
        expect(isReactRefreshBoundary({ wrapped: memoised })).toBe(true);
    });

    it("recognizes React.forwardRef-wrapped components", () => {
        const forwarded = (() => null) as { (): null; $$typeof?: symbol };
        forwarded.$$typeof = Symbol.for("react.forward_ref");
        expect(isReactRefreshBoundary({ wrapped: forwarded })).toBe(true);
    });

    it("returns false when a non-PascalCase named function is exported", () => {
        const helper = function lowercaseHelper() {
            return 1;
        };
        expect(isReactRefreshBoundary({ helper })).toBe(false);
    });
});

describe("performRefresh", () => {
    it("does not throw when invoked", () => {
        expect(() => performRefresh()).not.toThrow();
    });
});
