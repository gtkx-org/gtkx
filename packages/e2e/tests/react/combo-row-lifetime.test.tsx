import * as Adw from "@gtkx/gi/adw";
import * as Gtk from "@gtkx/gi/gtk";
import { AdwComboRow, AdwPreferencesGroup } from "@gtkx/jsx/adw";
import { GtkBox, GtkDropDown, GtkStringList } from "@gtkx/jsx/gtk";
import { getClassType } from "@gtkx/runtime";
import { cleanup, render, screen } from "@gtkx/testing";
import { setTimeout } from "node:timers/promises";
import { createRef } from "react";
import { expect, it } from "vitest";
import { itemFactory } from "../helpers/list-view-render.js";
import { gcUntil } from "../helpers/native-utils.js";

const disposeRowWithRetainedItem = async (shouldReplaceFactory: boolean): Promise<WeakRef<Gtk.Widget>> => {
    const ref = createRef<Adw.ComboRow>();
    await render(
        <AdwPreferencesGroup>
            <AdwComboRow ref={ref} title="Pick" model={<GtkStringList strings={["alpha", "beta"]} />} />
        </AdwPreferencesGroup>,
    );

    if (ref.current === null) {
        throw new Error("The row must be mounted");
    }

    const row = new WeakRef(ref.current);
    const item = screen.getByText("alpha").getParent()?.getParent();
    if (!item) {
        throw new Error("The displayed item must have a parent");
    }

    expect(screen.getByDisplayValue("alpha")).toBe(ref.current);
    if (shouldReplaceFactory) {
        ref.current.setExpression(Gtk.PropertyExpression.new(getClassType(Gtk.StringObject), null, "string"));
        expect(screen.getByDisplayValue("alpha")).toBe(ref.current);
    }

    await cleanup();
    await gcUntil(() => row.deref() === undefined);
    expect(row.deref()).toBeUndefined();
    expect(item.getParent()).toBeNull();

    return new WeakRef(item);
};

it.each([false, true])(
    "releases a displayed item after its ComboRow is destroyed (factory replaced: %s)",
    async (shouldReplaceFactory) => {
        const item = await disposeRowWithRetainedItem(shouldReplaceFactory);
        await gcUntil(() => item.deref() === undefined);
        expect(item.deref()).toBeUndefined();
        await setTimeout(40);
    },
);

it("disconnects retained item widgets from a destroyed ComboRow", async () => {
    const ref = createRef<Adw.ComboRow>();
    await render(
        <AdwPreferencesGroup>
            <AdwComboRow ref={ref} title="Pick" model={<GtkStringList strings={["alpha", "beta"]} />} />
        </AdwPreferencesGroup>,
    );

    if (ref.current === null) {
        throw new Error("The row must be mounted");
    }

    const row = new WeakRef(ref.current);
    const box = screen.getByText("alpha").getParent();
    const item = box?.getParent();
    if (item === null || item === undefined || !(box instanceof Gtk.Box)) {
        throw new Error("The displayed item widgets must be mounted");
    }

    await cleanup();
    await gcUntil(() => row.deref() === undefined);
    expect(row.deref()).toBeUndefined();
    expect(item.getParent()).toBeNull();
    box.notify("root");
    await setTimeout(40);
});

it("keeps default selection rendering after rejected model writes", async () => {
    const ref = createRef<Adw.ComboRow>();
    await render(
        <AdwPreferencesGroup>
            <AdwComboRow ref={ref} title="Pick" model={<GtkStringList strings={["alpha", "beta"]} />} />
        </AdwPreferencesGroup>,
    );

    const row = ref.current;
    if (row === null) {
        throw new Error("The row must be mounted");
    }

    expect(() => {
        Reflect.apply(row.setModel.bind(row), undefined, ["invalid"]);
    }).toThrow();
    row.setSelected(1);
    expect(screen.getByDisplayValue("beta")).toBe(row);
    row.setExpression(Gtk.PropertyExpression.new(getClassType(Gtk.StringObject), null, "string"));
    row.setSelected(0);
    expect(screen.getByDisplayValue("alpha")).toBe(row);
});

it("preserves a user factory shared with another widget after row destruction", async () => {
    const dropdownRef = createRef<Gtk.DropDown>();
    const rowRef = createRef<Adw.ComboRow>();
    const choices = ["first", "second"];
    const App = ({ shouldShowRow }: { shouldShowRow: boolean }) => (
        <GtkBox>
            <GtkDropDown
                ref={dropdownRef}
                factory={itemFactory()}
                model={<GtkStringList strings={choices} />}
            />
            {shouldShowRow && (
                <AdwPreferencesGroup>
                    <AdwComboRow ref={rowRef} title="Pick" model={<GtkStringList strings={["alpha", "beta"]} />} />
                </AdwPreferencesGroup>
            )}
        </GtkBox>
    );
    const { rerender } = await render(<App shouldShowRow />);
    const dropdown = dropdownRef.current;
    if (dropdown === null || rowRef.current === null) {
        throw new Error("Both widgets must be mounted");
    }

    rowRef.current.setFactory(dropdown.getFactory());
    rowRef.current.setSelected(1);
    expect(screen.getByDisplayValue("beta")).toBe(rowRef.current);

    const row = new WeakRef(rowRef.current);
    await rerender(<App shouldShowRow={false} />);
    await gcUntil(() => row.deref() === undefined);
    expect(row.deref()).toBeUndefined();
    dropdown.setSelected(1);
    expect(screen.getByDisplayValue("second")).toBe(dropdown);
});

it("keeps a retained row usable after unmount", async () => {
    const ref = createRef<Adw.ComboRow>();
    await render(
        <AdwPreferencesGroup>
            <AdwComboRow ref={ref} title="Pick" model={<GtkStringList strings={["alpha", "beta"]} />} />
        </AdwPreferencesGroup>,
    );

    const row = ref.current;
    if (row === null) {
        throw new Error("The row must be mounted");
    }

    const model = row.getModel();
    const factory = row.getFactory();
    await cleanup();
    await setTimeout(40);
    row.setModel(model);
    row.setSelected(1);

    const selected = row.getSelectedItem();
    if (!(selected instanceof Gtk.StringObject)) {
        throw new TypeError("The selected item must be a string");
    }

    expect(selected.getString()).toBe("beta");
    expect(row.getFactory()).toBe(factory);
    expect(row.getParent()).toBeNull();
});
