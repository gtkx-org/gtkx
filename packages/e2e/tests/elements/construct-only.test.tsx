import type * as Adw from "@gtkx/gi/adw";
import type * as Gtk from "@gtkx/gi/gtk";
import { AdwPreferencesPage } from "@gtkx/jsx/adw";
import { GtkBox } from "@gtkx/jsx/gtk";
import { render } from "@gtkx/testing";
import { createRef, type RefObject } from "react";
import { describe, expect, it } from "vitest";

function NamedBox({ boxRef, name }: { boxRef: RefObject<Gtk.Box | null>; name: string }) {
    return <GtkBox ref={boxRef} cssName={name} />;
}

function KeyedBox({ boxRef, name }: { boxRef: RefObject<Gtk.Box | null>; name: string }) {
    return <GtkBox key={name} ref={boxRef} cssName={name} />;
}

describe("construct-only properties", () => {
    it("sets cssName during widget construction", async () => {
        const ref = createRef<Gtk.Box>();
        await render(<GtkBox ref={ref} cssName="my-custom-widget" />);
        expect(ref.current).not.toBeNull();
        expect(ref.current).toHaveObjectProperty("cssName", "my-custom-widget");
    });

    it("creates widget without construct-only prop set", async () => {
        const ref = createRef<Gtk.Box>();
        await render(<GtkBox ref={ref} />);
        expect(ref.current).not.toBeNull();
        expect(ref.current?.getCssName()).toBeTruthy();
    });

    it("constructs and sets a property a class redeclares from an ancestor", async () => {
        const ref = createRef<Adw.PreferencesPage>();
        await render(<AdwPreferencesPage ref={ref} name="general" title="General" />);
        expect(ref.current).not.toBeNull();
        expect(ref.current).toHaveObjectProperty("name", "general");
        expect(ref.current).toHaveObjectProperty("title", "General");
    });
});

describe("construct-only property changes", () => {
    it("throws when a construct-only prop changes on re-render", async () => {
        const boxRef = createRef<Gtk.Box>();
        const { rerender } = await render(<NamedBox boxRef={boxRef} name="initial-name" />);
        expect(boxRef.current).toHaveObjectProperty("cssName", "initial-name");

        await expect(rerender(<NamedBox boxRef={boxRef} name="changed-name" />)).rejects.toThrow(
            /construct-only prop 'cssName' of <GtkBox>/,
        );
    });

    it("applies the new value when the key changes with it", async () => {
        const boxRef = createRef<Gtk.Box>();
        const { rerender } = await render(<KeyedBox boxRef={boxRef} name="initial-name" />);
        const initial = boxRef.current;
        expect(initial).toHaveObjectProperty("cssName", "initial-name");
        await rerender(<KeyedBox boxRef={boxRef} name="changed-name" />);
        expect(boxRef.current).not.toBe(initial);
        expect(boxRef.current).toHaveObjectProperty("cssName", "changed-name");
    });
});
