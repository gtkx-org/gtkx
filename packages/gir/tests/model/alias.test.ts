import { describe, expect, it } from "vitest";
import { GirAlias } from "../../src/model/alias.js";
import { GirType } from "../../src/model/type.js";

function makeType(overrides: { name?: string; isArray?: boolean } = {}): GirType {
    return new GirType({
        name: overrides.name ?? "Gtk.Widget",
        isArray: overrides.isArray ?? false,
        elementType: null,
        nullable: false,
    });
}

describe("GirAlias", () => {
    it("stores constructor data on read-only fields", () => {
        const target = makeType({ name: "Gtk.Widget" });
        const alias = new GirAlias({
            name: "WidgetAlias",
            qualifiedName: "Gtk.WidgetAlias",
            cType: "GtkWidgetAlias",
            targetType: target,
            doc: "An alias for Widget.",
        });

        expect(alias.name).toBe("WidgetAlias");
        expect(alias.qualifiedName).toBe("Gtk.WidgetAlias");
        expect(alias.cType).toBe("GtkWidgetAlias");
        expect(alias.targetType).toBe(target);
        expect(alias.doc).toBe("An alias for Widget.");
    });

    it("leaves doc undefined when not provided", () => {
        const alias = new GirAlias({
            name: "X",
            qualifiedName: "Gtk.X",
            cType: "GtkX",
            targetType: makeType(),
        });
        expect(alias.doc).toBeUndefined();
    });

    describe("isRecordAlias", () => {
        it("returns true when the target is a non-intrinsic, non-array type", () => {
            const alias = new GirAlias({
                name: "WidgetAlias",
                qualifiedName: "Gtk.WidgetAlias",
                cType: "GtkWidgetAlias",
                targetType: makeType({ name: "Gtk.Widget" }),
            });
            expect(alias.isRecordAlias()).toBe(true);
        });

        it("returns false when the target is an array type", () => {
            const alias = new GirAlias({
                name: "WidgetArrayAlias",
                qualifiedName: "Gtk.WidgetArrayAlias",
                cType: "GtkWidgetArrayAlias",
                targetType: makeType({ name: "Gtk.Widget", isArray: true }),
            });
            expect(alias.isRecordAlias()).toBe(false);
        });

        it("returns false when the target is an intrinsic type", () => {
            const alias = new GirAlias({
                name: "IntAlias",
                qualifiedName: "Gtk.IntAlias",
                cType: "gint",
                targetType: makeType({ name: "gint" }),
            });
            expect(alias.isRecordAlias()).toBe(false);
        });
    });
});
