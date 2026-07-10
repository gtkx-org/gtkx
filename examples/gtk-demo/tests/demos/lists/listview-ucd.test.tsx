import * as Gtk from "@gtkx/gi/gtk";
import { screen, userEvent, waitFor } from "@gtkx/testing";
import { describe, expect, it, vi } from "vitest";
import { listviewUcdDemo } from "../../../src/demos/lists/listview-ucd.js";
import { renderDemo } from "../../test-utils.js";

vi.setConfig({ testTimeout: 30000 });

const codepointCells = (): Gtk.Inscription[] =>
    screen.queryAllByText(/^0x[0-9a-f]{4,6}$/).map((widget) => widget as Gtk.Inscription);

const firstCodepointText = (): string => {
    const [cell] = codepointCells();
    if (!cell) throw new Error("expected at least one codepoint cell");
    const text = cell.getText();
    if (text === null) throw new Error("codepoint cell has no text");
    return text;
};

describe("listviewUcdDemo metadata", () => {
    it("exposes the expected metadata", () => {
        expect(listviewUcdDemo.id).toBe("listview-ucd");
        expect(listviewUcdDemo.title).toBe("Lists/Characters");
        expect(listviewUcdDemo.description.length).toBeGreaterThan(0);
        expect(Array.isArray(listviewUcdDemo.keywords)).toBe(true);
        expect(typeof listviewUcdDemo.sourceCode).toBe("string");
        expect(listviewUcdDemo.defaultWidth).toBe(800);
        expect(listviewUcdDemo.defaultHeight).toBe(400);
        expect(listviewUcdDemo.component).toBeTypeOf("function");
    });
});

describe("listviewUcdDemo column view", () => {
    it("renders a GtkColumnView with column separators enabled", async () => {
        await renderDemo(listviewUcdDemo);
        const cv = (await screen.findByName("column-view")) as Gtk.ColumnView;
        expect(cv.getShowColumnSeparators()).toBe(true);
    });

    it("declares the six expected columns", async () => {
        await renderDemo(listviewUcdDemo);
        const headers = await screen.findAllByRole(Gtk.AccessibleRole.COLUMN_HEADER);
        const expectedTitles = ["Codepoint", "Char", "Name", "Type", "Break Type", "Combining Class"];
        expect(headers).toHaveLength(expectedTitles.length);
        expectedTitles.forEach((title, i) => {
            expect(headers[i]).toHaveAccessibleName(title);
        });
    });

    it("groups the first section under the 'No script' heading and renders codepoint cells", async () => {
        await renderDemo(listviewUcdDemo);
        const heading = (await screen.findByText("No script")) as Gtk.Label;
        expect(heading.getCssClasses()).toContain("heading");
        const cells = codepointCells();
        expect(cells.length).toBeGreaterThan(0);
        expect(firstCodepointText()).toMatch(/^0x[0-9a-f]{4,6}$/);
    });

    it("renders the glyph for a printable character in the Char column", async () => {
        await renderDemo(listviewUcdDemo);
        await screen.findByName("column-view");
        // 0x0021 '!' lives in the initial COMMON ("No script") viewport and is printable
        await screen.findByText("!");
    });
});

describe("listviewUcdDemo selection", () => {
    it("previews the exact character of the activated row", async () => {
        await renderDemo(listviewUcdDemo);
        const cv = (await screen.findByName("column-view")) as Gtk.ColumnView;
        const preview = (await screen.findByName("selected-char")) as Gtk.Label;
        expect(preview).not.toHaveTextContent();
        const firstCodepoint = firstCodepointText();
        const expectedChar = String.fromCodePoint(Number.parseInt(firstCodepoint, 16));
        cv.grabFocus();
        await userEvent.keyboard(cv, "{ArrowDown}{Enter}");
        await waitFor(() => expect(preview.getLabel().length).toBeGreaterThan(0));
        expect(preview.getLabel()).toBe(expectedChar);
    });
});
