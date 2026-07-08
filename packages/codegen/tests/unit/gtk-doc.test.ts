import { describe, expect, it } from "vitest";
import { gtkDocToMarkdown } from "../../src/writer/gtk-doc.js";

describe("gtkDocToMarkdown", () => {
    it("maps the boolean and null constants to their JavaScript spellings", () => {
        expect(gtkDocToMarkdown("Returns %TRUE, %FALSE, or %NULL.")).toBe("Returns `true`, `false`, or `null`.");
    });

    it("wraps other %CONSTANT references in code spans", () => {
        expect(gtkDocToMarkdown("Defaults to %G_PRIORITY_DEFAULT.")).toBe("Defaults to `G_PRIORITY_DEFAULT`.");
    });

    it("camel-cases callable cross-references and appends parentheses", () => {
        expect(gtkDocToMarkdown("Call [method@Gtk.Widget.set_child].")).toBe("Call `Gtk.Widget.setChild()`.");
        expect(gtkDocToMarkdown("Use [func@Gtk.init].")).toBe("Use `Gtk.init()`.");
        expect(gtkDocToMarkdown("Prefer [ctor@Gtk.Button.new_with_label].")).toBe(
            "Prefer `Gtk.Button.newWithLabel()`.",
        );
    });

    it("renders property and signal references without parentheses", () => {
        expect(gtkDocToMarkdown("Bound to [property@Gtk.Editable:text].")).toBe("Bound to `Gtk.Editable.text`.");
        expect(gtkDocToMarkdown("Emits [signal@Gtk.Widget::destroy].")).toBe("Emits `Gtk.Widget.destroy`.");
    });

    it("renders type references without qualification", () => {
        expect(gtkDocToMarkdown("A [class@Gtk.Label] widget.")).toBe("A `Gtk.Label` widget.");
        expect(gtkDocToMarkdown("A #GtkWidget instance.")).toBe("A `GtkWidget` instance.");
    });

    it("wraps parameter references and function calls", () => {
        expect(gtkDocToMarkdown("Pass @child, then call gtk_widget_show().")).toBe(
            "Pass `child`, then call `gtk_widget_show()`.",
        );
    });

    it("converts gtk-doc code blocks to fenced Markdown", () => {
        const input = 'Example:\n|[<!-- language="C" -->\ngtk_button_new ();\n]|\ndone.';
        expect(gtkDocToMarkdown(input)).toBe("Example:\n```c\ngtk_button_new ();\n```\ndone.");
    });

    it("leaves existing code spans and unrelated numbers untouched", () => {
        expect(gtkDocToMarkdown("Keep `%TRUE literal` and up to 5 items.")).toBe(
            "Keep `%TRUE literal` and up to 5 items.",
        );
    });

    it("does not treat email-like or mid-word tokens as references", () => {
        expect(gtkDocToMarkdown("Reach a@b for 100% coverage of a#tag.")).toBe("Reach a@b for 100% coverage of a#tag.");
    });
});
