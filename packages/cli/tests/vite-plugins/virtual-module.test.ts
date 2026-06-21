import { describe, expect, it, vi } from "vitest";
import { createVirtualNamespace, resolveToVirtual } from "../../src/vite-plugins/virtual-module.js";

const PREFIX = "\0gtkx-test:";

describe("createVirtualNamespace", () => {
    const ns = createVirtualNamespace(PREFIX);

    it("wraps a real id behind the prefix", () => {
        expect(ns.toVirtualId("/abs/file.ts")).toBe(`${PREFIX}/abs/file.ts`);
    });

    it("recognizes ids in its own namespace", () => {
        expect(ns.isVirtual(`${PREFIX}/abs/file.ts`)).toBe(true);
        expect(ns.isVirtual("/abs/file.ts")).toBe(false);
    });

    it("recovers the real id from a virtual id", () => {
        expect(ns.fromVirtualId(`${PREFIX}/abs/file.ts`)).toBe("/abs/file.ts");
    });

    it("round-trips a real id through wrap then unwrap", () => {
        const realId = "/abs/style.css";
        expect(ns.fromVirtualId(ns.toVirtualId(realId))).toBe(realId);
    });
});

describe("resolveToVirtual", () => {
    it("resolves with skipSelf and wraps the resolved id", async () => {
        const resolve = vi.fn(() => Promise.resolve({ id: "/abs/style.css" }));
        const result = await resolveToVirtual(
            { resolve },
            { source: "./style.css", importer: "/importer.ts", options: { custom: 1 } },
            PREFIX,
        );
        expect(resolve).toHaveBeenCalledWith(
            "./style.css",
            "/importer.ts",
            expect.objectContaining({ custom: 1, skipSelf: true }),
        );
        expect(result).toBe(`${PREFIX}/abs/style.css`);
    });

    it("returns undefined when resolution yields null", async () => {
        const result = await resolveToVirtual(
            { resolve: () => Promise.resolve(null) },
            { source: "./x", importer: undefined, options: {} },
            PREFIX,
        );
        expect(result).toBeUndefined();
    });

    it("returns undefined when the resolved id is external", async () => {
        const result = await resolveToVirtual(
            { resolve: () => Promise.resolve({ id: "/abs/x.css", external: true }) },
            { source: "./x.css", importer: undefined, options: undefined },
            PREFIX,
        );
        expect(result).toBeUndefined();
    });
});
