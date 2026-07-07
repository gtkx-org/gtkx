import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const loadModule = async () => {
    vi.resetModules();
    return import("../src/animate-presence.js");
};

const Fixture = (): null => null;

const fixture = (key?: string): ReactElement => <Fixture key={key} />;

describe("onlyElements", () => {
    let warnSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        warnSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    });

    afterEach(() => {
        warnSpy.mockRestore();
        vi.unstubAllEnvs();
    });

    it("extracts keyed element children in order", async () => {
        const { onlyElements, getChildKey } = await loadModule();
        const a = fixture("a");
        const b = fixture("b");

        const result = onlyElements([a, b]);

        expect(result).toEqual([a, b]);
        expect(result.map(getChildKey)).toEqual(["a", "b"]);
    });

    it("accepts a single (non-array) child", async () => {
        const { onlyElements, getChildKey } = await loadModule();
        const only = fixture("only");

        const result = onlyElements(only);

        expect(result).toEqual([only]);
        expect(result.map(getChildKey)).toEqual(["only"]);
    });

    it("skips null, undefined, and primitive children", async () => {
        const { onlyElements, getChildKey } = await loadModule();
        const keyed = fixture("keep");

        const result = onlyElements([null, undefined, "text", 42, false, keyed]);

        expect(result).toEqual([keyed]);
        expect(result.map(getChildKey)).toEqual(["keep"]);
    });

    it("warns once in development for an element child without a key", async () => {
        vi.stubEnv("NODE_ENV", "development");
        const { onlyElements } = await loadModule();
        const unkeyed = fixture();

        onlyElements([unkeyed]);
        onlyElements([unkeyed]);

        expect(warnSpy).toHaveBeenCalledTimes(1);
        expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("without a key"));
    });

    it("does not warn in production for an element child without a key", async () => {
        vi.stubEnv("NODE_ENV", "production");
        const { onlyElements } = await loadModule();
        const unkeyed = fixture();

        onlyElements([unkeyed]);

        expect(warnSpy).not.toHaveBeenCalled();
    });
});
