import type * as Gtk from "@gtkx/gi/gtk";
import * as jsx from "@gtkx/jsx";
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

const IndexLabel = jsx.GtkLabel;
const index: Record<string, unknown> = jsx;

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

describe("@gtkx/jsx index entrypoint", () => {
    it("renders a widget imported from the package index", async () => {
        await render(<IndexLabel>Hello from the index</IndexLabel>);
        expect(screen.getByText("Hello from the index")).toBeRooted();
    });

    it("covers every namespace the store publishes", () => {
        const published = Object.keys(manifest.exports)
            .filter((key) => ![".", "./metadata", "./package.json"].includes(key))
            .map((key) => key.slice(2))
            .toSorted((left, right) => left.localeCompare(right));

        expect(Object.keys(NAMESPACES).toSorted((left, right) => left.localeCompare(right))).toEqual(published);
    });

    it("re-exports every export of every namespace unchanged", () => {
        for (const [directory, namespace] of Object.entries(NAMESPACES)) {
            for (const [name, value] of Object.entries(namespace)) {
                expect(index[name], `${directory} export ${name}`).toBe(value);
            }
        }
    });

    it("merges an augmentation of the index into the namespace that declares the props", async () => {
        const boxRef = createRef<Gtk.Box>();
        await render(<gtk.GtkBox ref={boxRef} indexAugmented />);
        expect(boxRef.current).toHaveClass("index-augmented");
    });
});

declare module "@gtkx/jsx" {
    /* eslint-disable @typescript-eslint/consistent-type-definitions -- declaration merging requires interfaces */
    interface GtkBoxProps {
        indexAugmented?: boolean;
    }
    /* eslint-enable @typescript-eslint/consistent-type-definitions */
}
