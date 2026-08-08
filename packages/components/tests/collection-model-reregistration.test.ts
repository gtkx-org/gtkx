import { describe, expect, it, vi } from "vitest";

const loadCollectionModel = async (): Promise<typeof import("../src/internal/collection-model.js")> => {
    vi.resetModules();

    return await import("../src/internal/collection-model.js");
};

describe("collection model registration", () => {
    it("does not register its GType a second time when the module is evaluated again", async () => {
        const first = await loadCollectionModel();
        expect(first.createCollectionModel()).toBeDefined();
        const second = await loadCollectionModel();
        expect(() => second.createCollectionModel()).not.toThrow();
    });
});
