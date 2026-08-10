import { ParamFlags, paramSpecString } from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkAdjustment } from "@gtkx/jsx/gtk";
import { createElementComponent } from "@gtkx/react/config";
import { registerClass } from "@gtkx/runtime";
import { render, screen } from "@gtkx/testing";
import { describe, expect, it } from "vitest";

type TaggedScaleProps = {
    name?: string;
    tag?: string;
    adjustment?: unknown;
};

const TaggedScaleElement = createElementComponent<TaggedScaleProps>("GtkxTaggedScale");

class TaggedScale extends Gtk.Scale {
    declare tag: string;
}

registerClass(TaggedScale, {
    typeName: "GtkxTaggedScale",
    properties: { tag: paramSpecString("tag", null, null, "none", ParamFlags.READWRITE) },
});

describe("createElementComponent for a type codegen does not cover", () => {
    it("renders a registered subclass with its own props", async () => {
        await render(<TaggedScaleElement name="tagged" tag="mine" />);
        const found = await screen.findByName("tagged");
        expect(found).toBeInstanceOf(TaggedScale);
        expect((found as TaggedScale).tag).toBe("mine");
    });

    it("routes an element-valued prop into its slot", async () => {
        await render(
            <TaggedScaleElement name="slotted" adjustment={<GtkAdjustment value={7} lower={0} upper={10} />} />,
        );

        const found = await screen.findByName("slotted");
        expect((found as Gtk.Scale).getAdjustment().getValue()).toBe(7);
    });
});
