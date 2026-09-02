import type * as Gtk from "@gtkx/gi/gtk";
import * as adw from "@gtkx/jsx/adw";
import * as gdk from "@gtkx/jsx/gdk";
import * as gdkpixbuf from "@gtkx/jsx/gdkpixbuf";
import * as gio from "@gtkx/jsx/gio";
import * as gobject from "@gtkx/jsx/gobject";
import * as gsk from "@gtkx/jsx/gsk";
import * as gtk from "@gtkx/jsx/gtk";
import * as gtksource from "@gtkx/jsx/gtksource";
import * as javascriptcore from "@gtkx/jsx/javascriptcore";
import manifest from "@gtkx/jsx/package.json" with { type: "json" };
import * as pango from "@gtkx/jsx/pango";
import * as soup from "@gtkx/jsx/soup";
import * as webkit from "@gtkx/jsx/webkit";
import { render, screen } from "@gtkx/testing";
import { createRef } from "react";
import { describe, expect, it } from "vitest";

const ROOT_SPECIFIER = "@gtkx/jsx";

const NAMESPACES: Record<string, Record<string, unknown>> = {
    adw,
    gdk,
    gdkpixbuf,
    gio,
    gobject,
    gsk,
    gtk,
    gtksource,
    javascriptcore,
    pango,
    soup,
    webkit,
};

describe("@gtkx/jsx namespace entrypoints", () => {
    it("renders an augmented widget imported from its namespace", async () => {
        const boxRef = createRef<Gtk.Box>();
        await render(
            <gtk.GtkBox ref={boxRef} indexAugmented>
                <gtk.GtkLabel>Hello from the namespace</gtk.GtkLabel>
            </gtk.GtkBox>,
        );
        expect(screen.getByText("Hello from the namespace")).toBeRooted();
        expect(boxRef.current).toHaveClass("index-augmented");
    });

    it("publishes every namespace without a package root", () => {
        const published = Object.keys(manifest.exports)
            .filter((key) => !["./metadata", "./package.json"].includes(key))
            .map((key) => key.slice(2))
            .toSorted((left, right) => left.localeCompare(right));

        expect(Object.hasOwn(manifest.exports, ".")).toBe(false);
        expect(Object.keys(NAMESPACES).toSorted((left, right) => left.localeCompare(right))).toEqual(published);
    });

    it("rejects the package root", async () => {
        await expect(import(ROOT_SPECIFIER)).rejects.toThrow();
    });
});

declare module "@gtkx/jsx/gtk" {
    /* eslint-disable @typescript-eslint/consistent-type-definitions -- declaration merging requires interfaces */
    interface GtkBoxProps {
        indexAugmented?: boolean;
    }
    /* eslint-enable @typescript-eslint/consistent-type-definitions */
}
