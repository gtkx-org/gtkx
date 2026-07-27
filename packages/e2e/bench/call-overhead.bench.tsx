import * as Gtk from "@gtkx/gi/gtk";
import { bench, describe } from "vitest";

const CALL_COUNTS = [100, 400];
const START_LABEL = "start";

const runSetterRoundTrips = (label: Gtk.Label, n: number): void => {
    for (let i = 0; i < n; i++) {
        label.setLabel(i % 2 === 0 ? "even" : "odd");
    }
};

const runGetterRoundTrips = (label: Gtk.Label, n: number): void => {
    let total = 0;

    for (let i = 0; i < n; i++) {
        total += label.getLabel().length;
    }

    if (total !== n * START_LABEL.length) {
        throw new Error(`Getter round trips returned unexpected text totaling ${String(total)}`);
    }
};

describe("ffi call overhead", () => {
    for (const n of CALL_COUNTS) {
        bench(`${String(n)} setter round trips`, () => {
            runSetterRoundTrips(new Gtk.Label({ label: START_LABEL }), n);
        });

        bench(`${String(n)} getter round trips`, () => {
            runGetterRoundTrips(new Gtk.Label({ label: START_LABEL }), n);
        });
    }
});
