import * as Gtk from "@gtkx/gi/gtk";
import { describe, expect, it } from "vitest";

const drain = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

function gc(): void {
    if (!global.gc) {
        throw new Error("global.gc is not available. Run tests with --expose-gc flag.");
    }
    global.gc();
}

/** Wraps the model in an isolated scope so no strong local pins it afterward. */
function touchControllers(button: Gtk.Button): void {
    button.observeControllers().getNItems();
}

describe("observeControllers wrapper lifetime", () => {
    it("diagnostic: whether observeControllers returns a cached, identity-tracked model", () => {
        const button = new Gtk.Button();
        const first = button.observeControllers();
        const second = button.observeControllers();
        console.log(`[diag] observeControllers cached (first === second): ${first === second}`);
        expect(first.getNItems()).toBeGreaterThanOrEqual(0);
    });

    it("reproduces: re-acquiring the cached model after its wrapper is collected must not read a freed object", async () => {
        const button = new Gtk.Button();
        button.addController(new Gtk.GestureClick());

        // Each iteration re-acquires the cached model right after its wrapper
        // is collected (cleanup still pending), which before the rebind fix
        // tripped a toggle-ref CRITICAL / freed-handle on roughly every pass.
        // A forced GC per pass is costly, so the count is kept low — at this
        // hit rate even a handful of passes would catch a regression — while
        // the timeout is widened for slower, loaded CI runners.
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

        // Each round rebinds several times before draining, so a batch of
        // deferred cleanups for the same model dispatches together. A stale
        // cleanup that tore down the live binding, or that dispatched ahead of
        // the live one, would surface as a toggle-ref CRITICAL or a freed read.
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
