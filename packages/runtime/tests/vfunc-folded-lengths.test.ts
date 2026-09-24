import * as Adw from "@gtkx/gi/adw";
import * as Gio from "@gtkx/gi/gio";
import * as Gtk from "@gtkx/gi/gtk";
import { quitApplication, registerClass } from "@gtkx/runtime";
import { describe, expect, it } from "vitest";

function createSwipeable(typeName: string, snapPoints: () => number[]): Adw.Swipeable {
    class Pager extends Gtk.Widget implements Adw.SwipeableImpl {
        override vfuncMeasure(): [number, number, number, number] {
            return [100, 100, -1, -1];
        }

        vfuncGetSnapPoints(): number[] {
            return snapPoints();
        }
    }

    registerClass(Pager, { typeName: `${typeName}_${String(process.pid)}`, implements: [Adw.Swipeable] });

    return new Pager({}) as Pager & Adw.Swipeable;
}

describe("vfunc return arrays whose length parameter is folded away", () => {
    it("returns the array a swipeable implementation hands back", () => {
        expect(createSwipeable("GtkxPagerJ", () => [0, 0.5, 1]).getSnapPoints()).toEqual([0, 0.5, 1]);
    });

    it("keeps a derived length in step with an array the implementation rebuilds", () => {
        let points = [0.25];
        const pager = createSwipeable("GtkxPagerK", () => points);
        expect(pager.getSnapPoints()).toEqual([0.25]);
        points = [];
        expect(pager.getSnapPoints()).toEqual([]);
        points = [0, 0.5, 0.75, 1];
        expect(pager.getSnapPoints()).toEqual([0, 0.5, 0.75, 1]);
    });
});

describe("vfunc input arrays whose length parameter is folded away", () => {
    it("derives the native length for overrides and parent calls", () => {
        const received: [string[], string][] = [];

        class OpeningApplication extends Gio.Application {
            override vfuncOpen(files: Gio.File[], hint: string): void {
                received.push([files.map((file) => file.getPath() ?? ""), hint]);
                super.vfuncOpen(files, hint);
            }
        }

        registerClass(OpeningApplication, { typeName: `GtkxFoldedOpen_${String(process.pid)}` });
        const application = new OpeningApplication({
            applicationId: `org.gtkx.folded-open-${String(process.pid)}`,
            flags: Gio.ApplicationFlags.NON_UNIQUE | Gio.ApplicationFlags.HANDLES_OPEN,
        });

        try {
            expect(application.register(null)).toBe(true);
            application.open([Gio.File.newForPath("/one"), Gio.File.newForPath("/two")], "first");
            application.open([Gio.File.newForPath("/three")], "second");
            expect(received).toEqual([
                [["/one", "/two"], "first"],
                [["/three"], "second"],
            ]);
        } finally {
            quitApplication(application);
        }
    });
});

describe("vtable slots reached through the vfunc member the bindings emit", () => {
    it("leaves the length of a returned array out of the result", () => {
        const carousel = new Adw.Carousel({});
        carousel.append(new Gtk.Label({ label: "one" }));
        carousel.append(new Gtk.Label({ label: "two" }));
        expect(carousel.vfuncGetSnapPoints()).toEqual(carousel.getSnapPoints());
    });

    it("leaves a 64-bit length out of the result and sizes the out array with it", () => {
        const label = new Gtk.Label({ label: "hello world", selectable: true });
        label.selectRegion(0, 5);
        const [hasSelection, ranges] = label.vfuncGetSelection();
        expect(hasSelection).toBe(true);
        expect(ranges.map((range) => [range.start, range.length])).toEqual([[0, 5]]);
    });

    it("leaves the length out of a result that carries several arrays", () => {
        const label = new Gtk.Label({ label: "hello world" });
        expect(label.vfuncGetAttributes(1)).toEqual([expect.any(Boolean), [], [], []]);
    });
});
