import * as Gtk from "@gtkx/gi/gtk";
import { bench, describe } from "vitest";

const CALL_COUNTS = [100, 400];

const START_LABEL = "start";

const benchWithLabel = (name: string, run: (label: Gtk.Label) => void): void => {
    bench(name, () => {
        run(new Gtk.Label({ label: START_LABEL }));
    });
};

describe("ffi call overhead", () => {
    for (const n of CALL_COUNTS) {
        benchWithLabel(`${n} setter round trips`, (label) => {
            for (let i = 0; i < n; i++) {
                label.setLabel(i % 2 === 0 ? "even" : "odd");
            }
        });

        benchWithLabel(`${n} getter round trips`, (label) => {
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
