import * as Gtk from "@gtkx/gi/gtk";
import { describe, expect, it } from "vitest";

const drain = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

function gc(): void {
    if (!global.gc) {
        throw new Error("global.gc is not available. Run tests with --expose-gc flag.");
    }
    global.gc();
}

function touchControllers(button: Gtk.Button): void {
    button.observeControllers().getNItems();
}

describe("observeControllers wrapper lifetime", () => {
    it("returns a cached, identity-tracked model", () => {
        const button = new Gtk.Button();
        const first = button.observeControllers();
        const second = button.observeControllers();
        expect(second).toBe(first);
        expect(first.getNItems()).toBeGreaterThanOrEqual(0);
    });

    it("reproduces: re-acquiring the cached model after its wrapper is collected must not read a freed object", async () => {
        const button = new Gtk.Button();
        button.addController(new Gtk.GestureClick());

        for (let i = 0; i < 150; i++) {
            touchControllers(button);
            await drain();
            gc();
            const controllers = button.observeControllers();
            expect(controllers.getNItems()).toBeGreaterThanOrEqual(0);
        }
    }, 30_000);

    it("survives a burst of rebinds whose cleanups are left pending together", async () => {
        const button = new Gtk.Button();
        button.addController(new Gtk.GestureClick());

        for (let round = 0; round < 40; round++) {
            for (let k = 0; k < 5; k++) {
                touchControllers(button);
                await drain();
                gc();
                button.observeControllers().getNItems();
            }
            await drain();
            expect(button.observeControllers().getNItems()).toBeGreaterThanOrEqual(0);
        }
    }, 30_000);
});
