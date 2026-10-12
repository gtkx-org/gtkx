import * as Adw from "@gtkx/gi/adw";
import * as Gtk from "@gtkx/gi/gtk";
import { AdwComboRow, AdwPreferencesGroup, AdwSpinRow } from "@gtkx/jsx/adw";
import { GtkAdjustment, GtkBox, GtkStringList } from "@gtkx/jsx/gtk";
import { act, render } from "@gtkx/testing";
import { createRef } from "react";
import { describe, expect, it } from "vitest";

const options = ["one", "two", "three"];

describe("dependent native properties", () => {
    it("assigns a native layout manager once while constructing a widget", async () => {
        const box = createRef<Gtk.Box>();
        const manager = Gtk.BoxLayout.new(Gtk.Orientation.VERTICAL);
        const app = <GtkBox ref={box} layoutManager={manager} />;
        const { rerender } = await render(app);
        expect(box.current?.getLayoutManager()).toBe(manager);
        expect(manager.getWidget()).toBe(box.current);
        await rerender(<GtkBox ref={box} layoutManager={manager} />);
        expect(box.current?.getLayoutManager()).toBe(manager);
    });

    it("applies nonzero selection after mounting a JSX model", async () => {
        const row = createRef<Adw.ComboRow>();
        const notifications: (number | null)[] = [];
        await render(
            <AdwPreferencesGroup>
                <AdwComboRow
                    ref={row}
                    selected={2}
                    onNotifySelected={(value) => notifications.push(value)}
                    model={<GtkStringList strings={options} />}
                />
            </AdwPreferencesGroup>,
        );
        expect(row.current?.getSelected()).toBe(2);
        expect(notifications).toEqual([]);
        await act(() => row.current?.setSelected(1));
        expect(notifications).toEqual([1]);
    });

    it("restores unchanged selection after replacing a JSX model without reporting user input", async () => {
        const row = createRef<Adw.ComboRow>();
        const notifications: (number | null)[] = [];
        const app = (version: number) => (
            <AdwPreferencesGroup>
                <AdwComboRow
                    ref={row}
                    selected={2}
                    onNotifySelected={(value) => notifications.push(value)}
                    model={<GtkStringList key={version} strings={options} />}
                />
            </AdwPreferencesGroup>
        );
        const { rerender } = await render(app(0));
        const original = row.current?.getModel();
        await rerender(app(1));
        expect(row.current?.getModel()).not.toBe(original);
        expect(row.current?.getSelected()).toBe(2);
        await rerender(app(1));
        expect(row.current?.getSelected()).toBe(2);
        expect(notifications).toEqual([]);
    });

    it("applies the controlled value after mounting and replacing a JSX adjustment", async () => {
        const row = createRef<Adw.SpinRow>();
        const notifications: (number | null)[] = [];
        const app = (version: number) => (
            <AdwPreferencesGroup>
                <AdwSpinRow
                    ref={row}
                    value={750}
                    onNotifyValue={(value) => notifications.push(value)}
                    adjustment={<GtkAdjustment key={version} lower={100} upper={1000} value={200} stepIncrement={50} />}
                />
            </AdwPreferencesGroup>
        );
        const { rerender } = await render(app(0));
        expect(row.current?.getValue()).toBe(750);
        const original = row.current?.getAdjustment();
        await rerender(app(1));
        expect(row.current?.getAdjustment()).not.toBe(original);
        expect(row.current?.getValue()).toBe(750);
        await rerender(app(1));
        expect(notifications).toEqual([]);
        await act(() => row.current?.setValue(800));
        expect(notifications).toEqual([800]);
    });
});
