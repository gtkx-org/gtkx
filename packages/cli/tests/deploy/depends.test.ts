import { describe, expect, it } from "vitest";
import { resolveDepends } from "../../src/deploy/depends.js";

describe("resolveDepends", () => {
    it("maps the declared GIR libraries onto distribution packages", () => {
        const relations = resolveDepends({}, ["Gtk-4.0", "Adw-1"], null);
        expect(relations.deb).toContain("libgtk-4-1");
        expect(relations.deb).toContain("libadwaita-1-0");
        expect(relations.rpm).toContain("gtk4");
        expect(relations.rpm).toContain("libadwaita");
    });

    it("maps the source view and webkit libraries", () => {
        const relations = resolveDepends({}, ["GtkSource-5", "WebKit-6.0"], null);
        expect(relations.deb).toEqual(expect.arrayContaining(["libgtksourceview-5-0", "libwebkitgtk-6.0-4"]));
        expect(relations.rpm).toEqual(expect.arrayContaining(["gtksourceview5", "webkitgtk6.0"]));
    });

    it("ignores a library with no known packaging", () => {
        expect(resolveDepends({}, ["Unknown-1"], null).deb).not.toContain("Unknown-1");
    });

    it("always depends on the icon themes and the desktop schemas", () => {
        const relations = resolveDepends({}, [], null);

        for (const packageName of ["hicolor-icon-theme", "adwaita-icon-theme", "gsettings-desktop-schemas"]) {
            expect(relations.deb.filter((entry) => entry === packageName)).toHaveLength(1);
            expect(relations.rpm.filter((entry) => entry === packageName)).toHaveLength(1);
        }
    });

    it("expresses the derived glibc floor in each format's own syntax", () => {
        const relations = resolveDepends({}, [], "2.41");
        expect(relations.deb).toContain("libc6 (>= 2.41)");
        expect(relations.rpm).toContain("glibc >= 2.41");
    });

    it("omits the glibc floor when it could not be derived", () => {
        const relations = resolveDepends({}, [], null);
        expect(relations.deb.some((entry) => entry.startsWith("libc6"))).toBe(false);
        expect(relations.rpm.some((entry) => entry.startsWith("glibc"))).toBe(false);
    });

    it("appends configured relations without duplicating them", () => {
        const relations = resolveDepends({ depends: { deb: ["libgtk-4-1", "extra"] } }, ["Gtk-4.0"], null);
        expect(relations.deb.filter((entry) => entry === "libgtk-4-1")).toHaveLength(1);
        expect(relations.deb).toContain("extra");
    });
});
