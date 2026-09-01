import * as Gtk from "@gtkx/gi/gtk";
import { screen, userEvent, waitFor } from "@gtkx/testing";
import { describe, expect, it, vi } from "vitest";
import { listviewUcdDemo } from "../../../src/demos/lists/listview-ucd.js";
import { renderDemo } from "../../test-utils.js";

const SCROLL_STEP = 200;
const MAX_SCROLL_STEPS = 40;

const scrollToGlyph = async (columnView: Gtk.ColumnView, glyph: string): Promise<void> => {
    for (let step = 0; step < MAX_SCROLL_STEPS && screen.queryAllByText(glyph).length === 0; step++) {
        await userEvent.scroll(columnView, { y: SCROLL_STEP });
    }
};

const codepointCells = (): Gtk.Inscription[] =>
    screen.queryAllByText(/^0x[0-9a-f]{4,6}$/, { as: Gtk.Inscription });

const firstCodepointText = (): string => {
    const [cell] = codepointCells();

    if (!cell) {
        throw new Error("expected at least one codepoint cell");
    }

    const text = cell.getText();

    if (text === null) {
        throw new Error("codepoint cell has no text");
    }

    return text;
};

vi.setConfig({ testTimeout: 30_000 });

describe("listviewUcdDemo column view", () => {
    it("renders a GtkColumnView with column separators enabled", async () => {
        await renderDemo(listviewUcdDemo);
        const cv = await screen.findByName("column-view", { as: Gtk.ColumnView });
        expect(cv).toHaveObjectProperty("showColumnSeparators", true);
    });

    it("declares the six expected columns", async () => {
        await renderDemo(listviewUcdDemo);
        const headers = await screen.findAllByRole(Gtk.AccessibleRole.COLUMN_HEADER);
        const expectedTitles = ["Codepoint", "Char", "Name", "Type", "Break Type", "Combining Class"];
        expect(headers).toHaveLength(expectedTitles.length);

        for (const [i, title] of expectedTitles.entries()) {
            expect(headers[i]).toHaveAccessibleName(title);
        }
    });

    it("groups the first section under the 'No script' heading and renders codepoint cells", async () => {
        await renderDemo(listviewUcdDemo);
        const heading = await screen.findByText("No script", { as: Gtk.Label });
        expect(heading).toHaveClass("heading");
        const cells = codepointCells();
        expect(cells.length).toBeGreaterThan(0);
        expect(firstCodepointText()).toMatch(/^0x[0-9a-f]{4,6}$/);
    });

    it("renders the glyph for a printable character in the Char column", async () => {
        await renderDemo(listviewUcdDemo);
        const columnView = await screen.findByName("column-view", { as: Gtk.ColumnView });
        await scrollToGlyph(columnView, "!");
        expect(await screen.findByText("!")).toHaveTextContent("!");
    });
});

describe("listviewUcdDemo selection", () => {
    it("previews the exact character of the activated row", async () => {
        await renderDemo(listviewUcdDemo);
        const cv = await screen.findByName("column-view", { as: Gtk.ColumnView });
        const preview = await screen.findByName("selected-char", { as: Gtk.Label });
        expect(preview).not.toHaveTextContent();
        const firstCodepoint = firstCodepointText();
        const expectedChar = String.fromCodePoint(Number.parseInt(firstCodepoint, 16));
        cv.grabFocus();
        await userEvent.keyboard(cv, "{ArrowDown}{Enter}");

        await waitFor(() => {
            expect(preview).toHaveObjectProperty("label", expectedChar);
        });
    });
});
