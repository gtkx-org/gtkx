import * as Gtk from "@gtkx/gi/gtk";
import { bench, describe } from "vitest";

/**
 * Gates the raw cost of one synchronous FFI round trip — `t.fn` argument
 * marshalling, the napi boundary, the mailbox dispatch to the GLib thread,
 * and the parked-thread wait — outside any React commit, so no freeze window
 * batches the calls. Valgrind-based instruction counting covers every thread
 * in the process, so both sides of the mailbox land in the measurement. Call
 * counts grow geometrically so the gate sees the per-call slope.
 */
const CALL_COUNTS = [100, 400];

const START_LABEL = "start";

describe("ffi call overhead", () => {
    for (const n of CALL_COUNTS) {
        bench(`${n} setter round trips`, () => {
            const label = new Gtk.Label({ label: START_LABEL });
            for (let i = 0; i < n; i++) {
                label.setLabel(i % 2 === 0 ? "even" : "odd");
            }
        });

        bench(`${n} getter round trips`, () => {
            const label = new Gtk.Label({ label: START_LABEL });
            let total = 0;
            for (let i = 0; i < n; i++) {
                total += label.getLabel().length;
            }
            if (total !== n * START_LABEL.length) {
                throw new Error(`Getter round trips returned unexpected text totaling ${total}`);
            }
        });
    }
});
