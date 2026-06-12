import type * as Adw from "@gtkx/gi/adw";
import { AdwComboRow } from "@gtkx/jsx/adw";
import { GtkLabel, GtkListBox } from "@gtkx/jsx/gtk";
import { render, screen } from "@gtkx/testing";
import { createRef, type ReactNode, type Ref } from "react";
import { describe, expect, it } from "vitest";

const items = [
    { id: "title", value: "By title" },
    { id: "date", value: "By date" },
    { id: "size", value: "By size" },
];

const ComboProbe = ({ selectedId, comboRef }: { selectedId: string; comboRef: Ref<Adw.ComboRow> }): ReactNode => (
    <GtkListBox>
        <AdwComboRow ref={comboRef} title="Sort Order" items={items} selectedId={selectedId} />
    </GtkListBox>
);

describe("render - AdwComboRow", () => {
    it("applies selectedId to the model selection", async () => {
        const ref = createRef<Adw.ComboRow>();

        await render(<ComboProbe selectedId="date" comboRef={ref} />);

        expect(ref.current?.getSelected()).toBe(1);
    });

    it("renders the selected item in the row display", async () => {
        const ref = createRef<Adw.ComboRow>();

        await render(<ComboProbe selectedId="date" comboRef={ref} />);

        const matches = await screen.findAllByText("By date");
        expect(matches.length).toBeGreaterThanOrEqual(2);
        const unselected = await screen.findAllByText("By size");
        expect(unselected.length).toBe(1);
    });

    it("updates the row display when selectedId changes", async () => {
        const ref = createRef<Adw.ComboRow>();

        const { rerender } = await render(<ComboProbe selectedId="title" comboRef={ref} />);
        await rerender(<ComboProbe selectedId="size" comboRef={ref} />);

        expect(ref.current?.getSelected()).toBe(2);
        const matches = await screen.findAllByText("By size");
        expect(matches.length).toBeGreaterThanOrEqual(2);
    });

    it("renders custom item templates", async () => {
        const ref = createRef<Adw.ComboRow>();

        await render(
            <GtkListBox>
                <AdwComboRow
                    ref={ref}
                    title="Sort Order"
                    items={items}
                    selectedId="date"
                    renderItem={(value: string) => <GtkLabel label={`Sorted ${value.toLowerCase()}`} />}
                />
            </GtkListBox>,
        );

        const matches = await screen.findAllByText("Sorted by date");
        expect(matches.length).toBeGreaterThanOrEqual(1);
    });
});
