import * as Gtk from "@gtkx/gi/gtk";
import { describe, expect, it } from "vitest";
import { forceGC } from "../helpers/native-utils.js";

const drain = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

function touchControllers(button: Gtk.Button): void {
    button.observeControllers().getNItems();
}

const expectControllerCyclesStayValid = async (button: Gtk.Button, iterations: number): Promise<void> => {
    for (let index = 0; index < iterations; index++) {
        touchControllers(button);
        await drain();
        forceGC();
        expect(button.observeControllers().getNItems()).toBeGreaterThanOrEqual(0);
    }
};

describe("observeControllers wrapper lifetime", () => {
    it("returns a cached, identity-tracked model", () => {
        const button = new Gtk.Button();
        const first = button.observeControllers();
        const second = button.observeControllers();
        expect(second).toBe(first);
        expect(first.getNItems()).toBeGreaterThanOrEqual(0);
    });

    it(
        "reproduces: re-acquiring the cached model after a wrapper is collected must not read a freed object",
        async () => {
            const button = new Gtk.Button();
            button.addController(new Gtk.GestureClick());
            await expectControllerCyclesStayValid(button, 150);
        },
        30_000,
    );

    it("survives a burst of rebinds whose cleanups are left pending together", async () => {
        const button = new Gtk.Button();
        button.addController(new Gtk.GestureClick());

        for (let round = 0; round < 40; round++) {
            await expectControllerCyclesStayValid(button, 5);
            await drain();
            expect(button.observeControllers().getNItems()).toBeGreaterThanOrEqual(0);
        }
    }, 30_000);
});
