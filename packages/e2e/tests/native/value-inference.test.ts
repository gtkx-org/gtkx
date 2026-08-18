import { TYPE_STRING, Value } from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import { readAccessibleString } from "@gtkx/testing/internal";
import { describe, expect, it } from "vitest";

describe("an accessible attribute updated with plain JavaScript values", () => {
    it("infers a GType for every item of the array", () => {
        const label = new Gtk.Label({ label: "text" });

        label.updateProperty(
            [Gtk.AccessibleProperty.LABEL, Gtk.AccessibleProperty.DESCRIPTION],
            ["Save", "Writes the file"],
        );

        expect(readAccessibleString(label, Gtk.AccessibleProperty.LABEL)).toBe("Save");
        expect(readAccessibleString(label, Gtk.AccessibleProperty.DESCRIPTION)).toBe("Writes the file");
    });

    it("takes an array mixing built values with inferred ones", () => {
        const label = new Gtk.Label({ label: "text" });
        const built = new Value();
        built.init(TYPE_STRING);
        built.setString("Writes the file");
        label.updateProperty([Gtk.AccessibleProperty.LABEL, Gtk.AccessibleProperty.DESCRIPTION], ["Open", built]);
        expect(readAccessibleString(label, Gtk.AccessibleProperty.LABEL)).toBe("Open");
        expect(readAccessibleString(label, Gtk.AccessibleProperty.DESCRIPTION)).toBe("Writes the file");
    });
});
