import type * as Gtk from "@gtkx/gi/gtk";
import * as Adw from "@gtkx/gi/adw";
import { AdwPreferencesGroup, AdwSwitchRow } from "@gtkx/jsx/adw";
import { createRef, type RefObject } from "react";
import { describe, expect, it } from "vitest";
import { renderChildren } from "./helpers/render-children.js";

function* walk(widget: Gtk.Widget): IterableIterator<Gtk.Widget> {
    let child = widget.getFirstChild();

    while (child) {
        yield child;
        yield* walk(child);
        child = child.getNextSibling();
    }
}

const rowTitles = (group: Adw.PreferencesGroup): string[] => {
    const titles: string[] = [];

    for (const widget of walk(group)) {
        if (widget instanceof Adw.PreferencesRow) {
            titles.push(widget.getTitle());
        }
    }

    return titles;
};

const buildGroup = (ref: RefObject<Adw.PreferencesGroup | null>) => (items: string[]) => (
    <AdwPreferencesGroup ref={ref}>
        {items.map((title) => (
            <AdwSwitchRow key={title} title={title} />
        ))}
    </AdwPreferencesGroup>
);

describe("reinsert fallback - add/remove container without insert", () => {
    it("removes a middle row", async () => {
        const ref = createRef<Adw.PreferencesGroup>();
        const { rerender } = await renderChildren(["A", "B", "C"], buildGroup(ref));
        await rerender(["A", "C"]);
        expect(rowTitles(ref.current as Adw.PreferencesGroup)).toEqual(["A", "C"]);
    });

    it("inserts a row in the middle via full rebuild", async () => {
        const ref = createRef<Adw.PreferencesGroup>();
        const { rerender } = await renderChildren(["A", "B", "C"], buildGroup(ref));
        await rerender(["A", "X", "B", "C"]);
        expect(rowTitles(ref.current as Adw.PreferencesGroup)).toEqual(["A", "X", "B", "C"]);
    });

    it("reverses row order via full rebuild", async () => {
        const ref = createRef<Adw.PreferencesGroup>();
        const { rerender } = await renderChildren(["A", "B", "C"], buildGroup(ref));
        await rerender(["C", "B", "A"]);
        expect(rowTitles(ref.current as Adw.PreferencesGroup)).toEqual(["C", "B", "A"]);
    });

    it("removes and reorders together via full rebuild", async () => {
        const ref = createRef<Adw.PreferencesGroup>();
        const { rerender } = await renderChildren(["A", "B", "C", "D"], buildGroup(ref));
        await rerender(["D", "A", "C"]);
        expect(rowTitles(ref.current as Adw.PreferencesGroup)).toEqual(["D", "A", "C"]);
    });
});
