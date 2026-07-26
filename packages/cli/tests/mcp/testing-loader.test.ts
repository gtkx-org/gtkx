import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type LoaderModule = typeof import("../../src/mcp/testing-loader.js");

const importLoader = async (): Promise<LoaderModule> => import("../../src/mcp/testing-loader.js");

const settled = async (run: () => Promise<unknown>): Promise<unknown> => {
    try {
        return await run();
    } catch (error) {
        return error;
    }
};

beforeEach(() => {
    vi.resetModules();
});

afterEach(() => {
    vi.doUnmock("@gtkx/testing");
    vi.resetModules();
});

describe("loadTestingModule", () => {
    it("caches successful imports across calls", async () => {
        vi.doMock("@gtkx/testing", () => ({ marker: "ok" }));
        const { loadTestingModule } = await importLoader();
        const first = await loadTestingModule();
        const second = await loadTestingModule();
        expect(first).toBe(second);
    });

    it("re-throws a hint-bearing error after a failed import and caches the failure", async () => {
        vi.doMock("@gtkx/testing", () => {
            throw new Error("not installed");
        });

        const { loadTestingModule } = await importLoader();
        const first = await settled(loadTestingModule);
        const second = await settled(loadTestingModule);
        expect(first).toBeInstanceOf(Error);
        expect((first as Error).message).toContain("@gtkx/testing is not installed");
        expect(second).toBe(first);
    });
});
