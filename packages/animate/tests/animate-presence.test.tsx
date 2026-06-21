import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const loadModule = async () => {
    vi.resetModules();
    return import("../src/animate-presence.js");
};

describe("toKeyedChildren", () => {
    let warnSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    });

    afterEach(() => {
        warnSpy.mockRestore();
        vi.unstubAllEnvs();
    });

    it("extracts keyed element children in order", async () => {
        const { toKeyedChildren } = await loadModule();
        const a = createElement("box", { key: "a" });
        const b = createElement("box", { key: "b" });

        const result = toKeyedChildren([a, b]);

        expect(result).toEqual([
            { key: "a", element: a },
            { key: "b", element: b },
        ]);
    });

    it("accepts a single (non-array) child", async () => {
        const { toKeyedChildren } = await loadModule();
        const only = createElement("box", { key: "only" });

        expect(toKeyedChildren(only)).toEqual([{ key: "only", element: only }]);
    });

    it("skips null, undefined, and primitive children", async () => {
        const { toKeyedChildren } = await loadModule();
        const keyed = createElement("box", { key: "keep" });

        const result = toKeyedChildren([null, undefined, "text", 42, false, keyed]);

        expect(result).toEqual([{ key: "keep", element: keyed }]);
    });

    it("warns once in development for an element child without a key", async () => {
        vi.stubEnv("NODE_ENV", "development");
        const { toKeyedChildren } = await loadModule();
        const unkeyed = createElement("box", {});

        toKeyedChildren([unkeyed]);
        toKeyedChildren([unkeyed]);

        expect(warnSpy).toHaveBeenCalledTimes(1);
        expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("without a key"));
    });

    it("does not warn in production for an element child without a key", async () => {
        vi.stubEnv("NODE_ENV", "production");
        const { toKeyedChildren } = await loadModule();
        const unkeyed = createElement("box", {});

        toKeyedChildren([unkeyed]);

        expect(warnSpy).not.toHaveBeenCalled();
    });
});
