import * as Gtk from "@gtkx/gi/gtk";
import { registerClass } from "@gtkx/runtime";
import { describe, expect, it } from "vitest";
import { createTypeNameFactory } from "../helpers/unique-name.js";

type Measurement = [number, number, number, number];

const uniqueName = createTypeNameFactory("_");

const newArea = (): Gtk.DrawingArea => new Gtk.DrawingArea({ contentWidth: 40, contentHeight: 30 });
const measureVertically = (widget: Gtk.Widget): Measurement => widget.measure(Gtk.Orientation.VERTICAL, -1);

const alignedBeside = (child: Gtk.Widget): Gtk.Box => {
    const box = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL });
    box.append(new Gtk.Label({ label: "baseline", valign: Gtk.Align.BASELINE_FILL }));
    box.append(child);

    return box;
};

const hosting = (layout: Gtk.LayoutManager, child: Gtk.Widget): Gtk.Widget => {
    const host = new Gtk.Box();
    host.setLayoutManager(layout);
    host.append(child);

    return host;
};

class ForwardingArea extends Gtk.DrawingArea {
    override vfuncMeasure(orientation: Gtk.Orientation, forSize: number): Measurement {
        const measurement = super.vfuncMeasure(orientation, forSize);

        return measurement;
    }
}

class ForwardingBinLayout extends Gtk.BinLayout {
    override vfuncMeasure(widget: Gtk.Widget, orientation: Gtk.Orientation, forSize: number): Measurement {
        const measurement = super.vfuncMeasure(widget, orientation, forSize);

        return measurement;
    }
}

registerClass(ForwardingArea, { typeName: uniqueName("GtkxSeededArea") });
registerClass(ForwardingBinLayout, { typeName: uniqueName("GtkxSeededBinLayout") });

describe("vfunc chain-up out parameter seeds", () => {
    it("hands the parent implementation the baselines the caller seeded", () => {
        const chained: Measurement[] = [];

        class ProbingArea extends Gtk.DrawingArea {
            override vfuncMeasure(orientation: Gtk.Orientation, forSize: number): Measurement {
                const measurement = super.vfuncMeasure(orientation, forSize);
                chained.push(measurement);

                return measurement;
            }
        }

        registerClass(ProbingArea, { typeName: uniqueName("GtkxProbingArea") });
        const area = new ProbingArea({ contentWidth: 40, contentHeight: 30 });
        expect(measureVertically(area)).toEqual([30, 30, -1, -1]);
        expect(chained).toEqual([[30, 30, -1, -1]]);
    });

    it("reports the baselines of a plain widget from an override that only forwards", () => {
        const forwarding = new ForwardingArea({ contentWidth: 40, contentHeight: 30 });
        expect(measureVertically(forwarding)).toEqual([30, 30, -1, -1]);
        expect(measureVertically(forwarding)).toEqual(measureVertically(newArea()));
    });

    it("keeps a forwarding override out of the height a baseline-aligned box asks for", () => {
        const forwarding = alignedBeside(new ForwardingArea({ contentWidth: 40, contentHeight: 30 }));
        const plain = alignedBeside(newArea());
        expect(measureVertically(forwarding)).toEqual(measureVertically(plain));
    });

    it("seeds the baselines a layout manager slot chains up with", () => {
        const forwarding = hosting(new ForwardingBinLayout(), newArea());
        const plain = hosting(new Gtk.BinLayout(), newArea());
        expect(measureVertically(forwarding)).toEqual([30, 30, -1, -1]);
        expect(measureVertically(forwarding)).toEqual(measureVertically(plain));
    });
});

describe("vfunc chain-up out parameter seeds across a hierarchy", () => {
    it("carries the seeds through every level of a hierarchy that forwards", () => {
        class OuterArea extends ForwardingArea {
            override vfuncMeasure(orientation: Gtk.Orientation, forSize: number): Measurement {
                const [minimum, natural, minimumBaseline, naturalBaseline] = super.vfuncMeasure(orientation, forSize);

                return [minimum, natural, minimumBaseline, naturalBaseline];
            }
        }

        registerClass(OuterArea, { typeName: uniqueName("GtkxSeededOuterArea") });
        const outer = new OuterArea({ contentWidth: 40, contentHeight: 30 });
        expect(measureVertically(outer)).toEqual([30, 30, -1, -1]);
    });

    it("seeds the baselines of a slot invoked outside any override of it", () => {
        class ProbingArea extends Gtk.DrawingArea {
            measureThroughSlot(): Measurement {
                return this.vfuncMeasure(Gtk.Orientation.VERTICAL, -1);
            }
        }

        registerClass(ProbingArea, { typeName: uniqueName("GtkxDirectArea") });
        const area = new ProbingArea({ contentWidth: 40, contentHeight: 30 });
        expect(area.measureThroughSlot()).toEqual([30, 30, -1, -1]);
    });
});
