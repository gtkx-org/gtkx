import * as Adw from "@gtkx/gi/adw";
import { AdwSpinRow } from "@gtkx/jsx/adw";
import { GtkAdjustment, GtkListBox } from "@gtkx/jsx/gtk";
import { act, render, screen, userEvent } from "@gtkx/testing";
import { describe, expect, it } from "vitest";

type InsertAction = "type" | "paste";

const renderSpinRow = async (): Promise<Adw.SpinRow> => {
    await render(
        <GtkListBox>
            <AdwSpinRow
                name="input"
                title="Value"
                numeric={false}
                adjustment={<GtkAdjustment lower={0} upper={100} stepIncrement={1} />}
            />
        </GtkListBox>,
    );

    const row = screen.getByName("input", { as: Adw.SpinRow });
    await userEvent.type(row, "12345", { initialSelectionStart: 0, initialSelectionEnd: -1 });
    expect(row.getText()).toBe("12345");

    return row;
};

const insert = (row: Adw.SpinRow, action: InsertAction, text: string): Promise<void> =>
    action === "type" ? userEvent.type(row, text, { shouldFocus: false }) : userEvent.paste(row, text);

describe.each(["type", "paste"] as const)("userEvent.%s with a delegated editable", (action) => {
    it.each(["abc", "éλ🚀"])("replaces a selection with all characters in %s", async (text) => {
        const row = await renderSpinRow();
        await act(() => {
            row.selectRegion(1, 4);
        });
        await insert(row, action, text);
        expect(row.getText()).toBe(`1${text}5`);
        expect(row.getPosition()).toBe(4);
    });

    it("keeps text and caret unchanged when inserting an empty string", async () => {
        const row = await renderSpinRow();
        await act(() => {
            row.selectRegion(1, 1);
        });
        await insert(row, action, "");
        expect(row.getText()).toBe("12345");
        expect(row.getPosition()).toBe(1);
    });

    it("rejects NUL text before insertion and accepts a later valid edit", async () => {
        const row = await renderSpinRow();
        await act(() => {
            row.selectRegion(5, 5);
        });
        await expect(insert(row, action, "x\0y")).rejects.toThrow();
        expect(row.getText()).toBe("12345");
        expect(row.getPosition()).toBe(5);
        await insert(row, action, "!");
        expect(row.getText()).toBe("12345!");
        expect(row.getPosition()).toBe(6);
    });
});
