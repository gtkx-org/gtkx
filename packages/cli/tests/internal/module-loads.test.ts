import { describe, expect, it, vi } from "vitest";
import { loadModuleExclusively, withExclusiveLoad } from "../../src/internal/module-loads.js";

const flushTick = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

describe("withExclusiveLoad", () => {
    it("runs loads for one server one at a time, in the order they were requested", async () => {
        const server = {};
        const order: string[] = [];
        const first = Promise.withResolvers<null>();
        const second = Promise.withResolvers<null>();

        const firstRun = withExclusiveLoad(server, async () => {
            order.push("first started");
            await first.promise;
            order.push("first finished");
        });

        const secondRun = withExclusiveLoad(server, async () => {
            order.push("second started");
            await second.promise;
        });

        await flushTick();
        expect(order).toEqual(["first started"]);
        first.resolve(null);
        second.resolve(null);
        await Promise.all([firstRun, secondRun]);
        expect(order).toEqual(["first started", "first finished", "second started"]);
    });

    it("keeps loads for separate servers independent", async () => {
        const started: string[] = [];
        const held = Promise.withResolvers<null>();

        const blocked = withExclusiveLoad({}, async () => {
            started.push("first");
            await held.promise;
        });

        await withExclusiveLoad({}, () => {
            started.push("second");

            return Promise.resolve();
        });

        expect(started).toEqual(["first", "second"]);
        held.resolve(null);
        await blocked;
    });

    it("keeps serving later loads after one rejects", async () => {
        const server = {};
        const failing = withExclusiveLoad(server, () => Promise.reject(new Error("PROBE: load failed")));
        await expect(failing).rejects.toThrow("PROBE: load failed");
        await expect(withExclusiveLoad(server, () => Promise.resolve("loaded"))).resolves.toBe("loaded");
    });

    it("passes a module id straight through to the server it belongs to", async () => {
        const exports = { marker: 1 };
        const server = { ssrLoadModule: vi.fn(() => Promise.resolve(exports)) };
        await expect(loadModuleExclusively(server, "/x/component.tsx")).resolves.toBe(exports);
        expect(server.ssrLoadModule).toHaveBeenCalledWith("/x/component.tsx");
    });
});
