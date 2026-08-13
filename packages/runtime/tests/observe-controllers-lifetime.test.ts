import * as Gtk from "@gtkx/gi/gtk";
import { describe, expect, it } from "vitest";
import { forceGC } from "./helpers/native-utils.js";

const drain = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));
const countControllers = (button: Gtk.Button): number => button.observeControllers().getNItems();

const expectControllerCyclesStayValid = async (button: Gtk.Button, iterations: number): Promise<void> => {
    const expected = countControllers(button);

    for (let index = 0; index < iterations; index++) {
        countControllers(button);
        await drain();
        forceGC();
        expect(countControllers(button)).toBe(expected);
    }
};

describe("observeControllers wrapper lifetime", () => {
    it("returns a cached, identity-tracked model that tracks later additions", () => {
        const button = new Gtk.Button();
        const first = button.observeControllers();
        const before = first.getNItems();
        button.addController(new Gtk.GestureClick());
        expect(button.observeControllers()).toBe(first);
        expect(first.getNItems()).toBe(before + 1);
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
        const expected = countControllers(button);

        for (let round = 0; round < 40; round++) {
            await expectControllerCyclesStayValid(button, 5);
            await drain();
            expect(countControllers(button)).toBe(expected);
        }
    }, 30_000);
});
