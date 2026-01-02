import { type QualifiedName, qualifiedName } from "@gtkx/gir";
import { describe, expect, it } from "vitest";
import { parseParentReference } from "../../../src/core/utils/parent-reference.js";

describe("parseParentReference", () => {
    describe("with no parent", () => {
        it("returns hasParent false for null", () => {
            const result = parseParentReference(null, "Gtk");
            expect(result.hasParent).toBe(false);
            expect(result.isCrossNamespace).toBe(false);
            expect(result.className).toBe("");
            expect(result.originalName).toBe("");
            expect(result.extendsClause).toBe(" extends NativeObject");
        });

        it("returns hasParent false for undefined", () => {
            const result = parseParentReference(undefined, "Gtk");
            expect(result.hasParent).toBe(false);
        });
    });

    describe("with same-namespace parent", () => {
        it("parses same-namespace parent correctly", () => {
            const result = parseParentReference(qualifiedName("Gtk", "Widget"), "Gtk");
            expect(result.hasParent).toBe(true);
            expect(result.isCrossNamespace).toBe(false);
            expect(result.className).toBe("Widget");
            expect(result.originalName).toBe("Widget");
            expect(result.namespace).toBeUndefined();
            expect(result.extendsClause).toBe(" extends Widget");
            expect(result.importStatement).toBe('import { Widget } from "./widget.js";');
        });

        it("normalizes class name", () => {
            const result = parseParentReference(qualifiedName("Gtk", "tree_view"), "Gtk");
            expect(result.className).toBe("TreeView");
            expect(result.originalName).toBe("tree_view");
        });

        it("generates correct import path for kebab-case", () => {
            const result = parseParentReference(qualifiedName("Gtk", "TreeView"), "Gtk");
            expect(result.importStatement).toBe('import { TreeView } from "./tree-view.js";');
        });
    });

    describe("with cross-namespace parent", () => {
        it("parses cross-namespace parent correctly", () => {
            const result = parseParentReference(qualifiedName("GObject", "Object"), "Gtk");
            expect(result.hasParent).toBe(true);
            expect(result.isCrossNamespace).toBe(true);
            expect(result.namespace).toBe("GObject");
            expect(result.className).toBe("GObject");
            expect(result.originalName).toBe("Object");
            expect(result.extendsClause).toBe(" extends GObject.GObject");
            expect(result.importStatement).toBeUndefined();
        });

        it("handles Adw extending Gtk correctly", () => {
            const result = parseParentReference(qualifiedName("Gtk", "Window"), "Adw");
            expect(result.hasParent).toBe(true);
            expect(result.isCrossNamespace).toBe(true);
            expect(result.namespace).toBe("Gtk");
            expect(result.className).toBe("Window");
            expect(result.extendsClause).toBe(" extends Gtk.Window");
        });

        it("handles GObject.InitiallyUnowned correctly", () => {
            const result = parseParentReference(qualifiedName("GObject", "InitiallyUnowned"), "Gtk");
            expect(result.hasParent).toBe(true);
            expect(result.isCrossNamespace).toBe(true);
            expect(result.namespace).toBe("GObject");
            expect(result.className).toBe("InitiallyUnowned");
            expect(result.extendsClause).toBe(" extends GObject.InitiallyUnowned");
        });
    });

    describe("special cases", () => {
        it("handles Error -> GError renaming", () => {
            const result = parseParentReference(qualifiedName("GLib", "Error"), "Gtk");
            expect(result.className).toBe("GError");
            expect(result.originalName).toBe("Error");
            expect(result.extendsClause).toBe(" extends GLib.GError");
        });

        it("handles GObject.Object -> GObject renaming in GObject namespace", () => {
            const result = parseParentReference(qualifiedName("GObject", "Object"), "GObject");
            expect(result.hasParent).toBe(true);
            expect(result.isCrossNamespace).toBe(false);
            expect(result.className).toBe("GObject");
            expect(result.originalName).toBe("Object");
            expect(result.importStatement).toBe('import { GObject } from "./object.js";');
        });
    });

    describe("with string parent", () => {
        it("parses string parent as qualified name", () => {
            const result = parseParentReference("Gtk.Widget" as QualifiedName, "Gtk");
            expect(result.hasParent).toBe(true);
            expect(result.className).toBe("Widget");
        });
    });
});
