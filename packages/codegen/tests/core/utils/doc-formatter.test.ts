import { describe, expect, it } from "vitest";
import { buildJsDocStructure, sanitizeDoc } from "../../../src/core/utils/doc-formatter.js";

describe("sanitizeDoc", () => {
    describe("basic text", () => {
        it("returns trimmed text", () => {
            expect(sanitizeDoc("  Hello world  ")).toBe("Hello world");
        });

        it("cleans up excessive newlines", () => {
            expect(sanitizeDoc("Line 1\n\n\n\nLine 2")).toBe("Line 1\n\nLine 2");
        });

        it("removes trailing whitespace from lines", () => {
            expect(sanitizeDoc("Line 1   \nLine 2  ")).toBe("Line 1\nLine 2");
        });
    });

    describe("GIR link conversion", () => {
        it("converts class links", () => {
            expect(sanitizeDoc("[class@Gtk.Button]")).toBe("{@link Gtk.Button}");
        });

        it("converts interface links", () => {
            expect(sanitizeDoc("[iface@Gio.ListModel]")).toBe("{@link Gio.ListModel}");
        });

        it("converts method links", () => {
            expect(sanitizeDoc("[method@Gtk.Widget.show]")).toBe("{@link Gtk.Widget.show}");
        });

        it("converts property links", () => {
            expect(sanitizeDoc("[property@Gtk.Button:label]")).toBe("{@link Gtk.Button.label}");
        });

        it("converts signal links", () => {
            expect(sanitizeDoc("[signal@Gtk.Button::clicked]")).toBe("{@link Gtk.Button.:clicked}");
        });

        it("converts func links", () => {
            expect(sanitizeDoc("[func@Gtk.init]")).toBe("{@link Gtk.init}");
        });

        it("converts const links", () => {
            expect(sanitizeDoc("[const@Gtk.MAJOR_VERSION]")).toBe("{@link Gtk.MAJOR_VERSION}");
        });

        it("converts id links to backticks", () => {
            expect(sanitizeDoc("[id@some_id]")).toBe("`some_id`");
        });

        it("converts enum links", () => {
            expect(sanitizeDoc("[enum@Gtk.Orientation]")).toBe("{@link Gtk.Orientation}");
        });

        it("handles invalid links gracefully", () => {
            expect(sanitizeDoc("[invalid@Foo]")).toBe("`Foo`");
        });
    });

    describe("link style options", () => {
        it("uses namespaced style by default", () => {
            const result = sanitizeDoc("[class@Gtk.Button]", { linkStyle: "namespaced" });
            expect(result).toBe("{@link Gtk.Button}");
        });

        it("uses prefixed style when specified", () => {
            const result = sanitizeDoc("[class@Adw.HeaderBar]", { linkStyle: "prefixed" });
            expect(result).toBe("{@link AdwHeaderBar}");
        });

        it("omits namespace prefix for Gtk in prefixed mode", () => {
            const result = sanitizeDoc("[class@Gtk.Button]", { linkStyle: "prefixed" });
            expect(result).toBe("{@link Button}");
        });
    });

    describe("@ annotation conversion", () => {
        it("converts standalone @ annotations to backticks", () => {
            expect(sanitizeDoc("Use @param_name here")).toBe("Use `param_name` here");
        });

        it("does not convert @ inside {@ links", () => {
            expect(sanitizeDoc("{@link Button}")).toBe("{@link Button}");
        });
    });

    describe("HTML link stripping", () => {
        it("strips .html links keeping text", () => {
            expect(sanitizeDoc("[Click here](page.html)")).toBe("Click here");
            expect(sanitizeDoc("[More info](doc.html#section)")).toBe("More info");
        });
    });

    describe("kbd element conversion", () => {
        it("converts kbd elements to backticks", () => {
            expect(sanitizeDoc("Press <kbd>Enter</kbd>")).toBe("Press `Enter`");
        });
    });

    describe("image conversion", () => {
        it("converts picture elements with img", () => {
            const input = '<picture><img alt="Button" src="images/button.png"></picture>';
            const result = sanitizeDoc(input, { namespace: "Gtk" });
            expect(result).toBe("![Button](https://docs.gtk.org/gtk4/images/button.png)");
        });

        it("converts standalone img elements", () => {
            const input = '<img alt="Widget" src="widget.png">';
            const result = sanitizeDoc(input, { namespace: "Gtk" });
            expect(result).toBe("![Widget](https://docs.gtk.org/gtk4/widget.png)");
        });

        it("keeps absolute URLs unchanged", () => {
            const input = '<img alt="Logo" src="https://example.com/logo.png">';
            expect(sanitizeDoc(input)).toBe("![Logo](https://example.com/logo.png)");
        });

        it("converts relative markdown images", () => {
            const input = "![Screenshot](screenshot.png)";
            const result = sanitizeDoc(input, { namespace: "Gtk" });
            expect(result).toBe("![Screenshot](https://docs.gtk.org/gtk4/screenshot.png)");
        });
    });

    describe("XML tag escaping", () => {
        it("escapes XML-style tags when option enabled", () => {
            const input = "Use <child> element";
            const result = sanitizeDoc(input, { escapeXmlTags: true });
            expect(result).toBe("Use `<child>` element");
        });

        it("does not escape XML tags in code blocks", () => {
            const input = "```xml\n<child>\n</child>\n```";
            const result = sanitizeDoc(input, { escapeXmlTags: true });
            expect(result).toBe("```xml\n<child>\n</child>\n```");
        });

        it("escapes property and signal elements", () => {
            const input = "<property> and <signal>";
            const result = sanitizeDoc(input, { escapeXmlTags: true });
            expect(result).toBe("`<property>` and `<signal>`");
        });
    });

    describe("namespace URL resolution", () => {
        it("uses correct base URL for Gtk", () => {
            const result = sanitizeDoc("![](image.png)", { namespace: "Gtk" });
            expect(result).toContain("https://docs.gtk.org/gtk4");
        });

        it("uses correct base URL for Adw", () => {
            const result = sanitizeDoc("![](image.png)", { namespace: "Adw" });
            expect(result).toContain("https://gnome.pages.gitlab.gnome.org/libadwaita");
        });

        it("uses correct base URL for GLib", () => {
            const result = sanitizeDoc("![](image.png)", { namespace: "GLib" });
            expect(result).toContain("https://docs.gtk.org/glib");
        });

        it("uses correct base URL for Gio", () => {
            const result = sanitizeDoc("![](image.png)", { namespace: "Gio" });
            expect(result).toContain("https://docs.gtk.org/gio");
        });
    });
});

describe("buildJsDocStructure", () => {
    it("returns undefined for undefined doc", () => {
        expect(buildJsDocStructure(undefined, "Gtk")).toBeUndefined();
    });

    it("returns undefined for empty doc", () => {
        expect(buildJsDocStructure("", "Gtk")).toBeUndefined();
    });

    it("returns array with description for valid doc", () => {
        const result = buildJsDocStructure("A simple button widget.", "Gtk");
        expect(result).toEqual([{ description: "A simple button widget." }]);
    });

    it("sanitizes doc before returning", () => {
        const result = buildJsDocStructure("[class@Gtk.Button] example", "Gtk");
        expect(result).toEqual([{ description: "{@link Gtk.Button} example" }]);
    });
});
