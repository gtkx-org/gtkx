import { describe, expect, it } from "vitest";
import { RenderableSlotsRegistry } from "../../src/config/index.js";

describe("RenderableSlotsRegistry", () => {
    it("returns the built-in slot set for a known JSX name without overrides", () => {
        const registry = new RenderableSlotsRegistry();
        expect([...registry.get("GtkWindow")]).toEqual(["titlebar"]);
    });

    it("returns an empty set for an unknown JSX name", () => {
        const registry = new RenderableSlotsRegistry();
        expect(registry.get("NotAWidget").size).toBe(0);
    });

    it("registers a user-supplied JSX name's slot props", () => {
        const registry = new RenderableSlotsRegistry({ MyAppFooBar: ["content"] });
        expect([...registry.get("MyAppFooBar")]).toEqual(["content"]);
    });

    it("merges user overrides with built-in slots for the same JSX name", () => {
        const registry = new RenderableSlotsRegistry({ GtkWindow: ["extra"] });
        expect([...registry.get("GtkWindow")].sort()).toEqual(["extra", "titlebar"]);
    });

    it("does not mutate the built-in map when overrides supplied", () => {
        new RenderableSlotsRegistry({ GtkWindow: ["extra"] });
        const defaultRegistry = new RenderableSlotsRegistry();
        expect([...defaultRegistry.get("GtkWindow")]).toEqual(["titlebar"]);
    });
});
