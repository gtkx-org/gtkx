import type { ReactNode, RefObject } from "react";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkLabel, GtkListBox, GtkListBoxRow, GtkNotebook, GtkNotebookPage } from "@gtkx/jsx/gtk";
import { render, screen, userEvent } from "@gtkx/testing";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";

type NotebookFixture = { notebook: Gtk.Notebook; onSwitchPage: ReturnType<typeof vi.fn> };

const TAB_LABELS = ["Tab one", "Tab two", "Tab three"];

const notebookElement = (ref: RefObject<Gtk.Notebook | null>, onSwitchPage: () => void): ReactNode => (
    <GtkNotebook ref={ref} onSwitchPage={onSwitchPage}>
        {TAB_LABELS.map((label, index) => (
            <GtkNotebookPage key={label} tabLabel={label}>
                <GtkLabel>{`Page ${String(index)}`}</GtkLabel>
            </GtkNotebookPage>
        ))}
    </GtkNotebook>
);

const renderFixture = async (wrap: (book: ReactNode) => ReactNode = (book) => book): Promise<NotebookFixture> => {
    const ref = createRef<Gtk.Notebook>();
    const onSwitchPage = vi.fn();
    await render(wrap(notebookElement(ref, onSwitchPage)));

    return { notebook: ref.current as Gtk.Notebook, onSwitchPage };
};

const renderAndClick = async (text: string): Promise<NotebookFixture> => {
    const fixture = await renderFixture();
    await userEvent.click(screen.getByText(text));

    return fixture;
};

describe("clicking a notebook tab", () => {
    it("switches to the page whose tab label is clicked", async () => {
        const { notebook, onSwitchPage } = await renderAndClick("Tab two");
        expect(notebook.getCurrentPage()).toBe(1);
        expect(onSwitchPage).toHaveBeenCalledWith(expect.anything(), 1, notebook);
    });

    it("switches to the page whose tab widget is clicked", async () => {
        const { notebook } = await renderFixture();
        await userEvent.click(screen.getAllByRole(Gtk.AccessibleRole.TAB)[2] as Gtk.Widget);
        expect(notebook.getCurrentPage()).toBe(2);
    });

    it("maps the page behind the clicked tab", async () => {
        await renderAndClick("Tab three");
        expect(screen.getByText("Page 2").getMapped()).toBe(true);
    });

    it("stays on the page a double click opens", async () => {
        const { notebook } = await renderFixture();
        await userEvent.dblClick(screen.getByText("Tab two"));
        expect(notebook.getCurrentPage()).toBe(1);
    });

    it("leaves the page alone when the page content is clicked", async () => {
        const { notebook, onSwitchPage } = await renderAndClick("Page 0");
        expect(notebook.getCurrentPage()).toBe(0);
        expect(onSwitchPage).not.toHaveBeenCalled();
    });
});

describe("clicking a notebook tab nested in another widget", () => {
    it("switches the page of a notebook nested in a row instead of activating the row", async () => {
        const onRowActivated = vi.fn();

        const { notebook } = await renderFixture((book) => (
            <GtkListBox selectionMode={Gtk.SelectionMode.SINGLE} onRowActivated={onRowActivated}>
                <GtkListBoxRow>{book}</GtkListBoxRow>
            </GtkListBox>
        ));

        await userEvent.click(screen.getByText("Tab two"));
        expect(notebook.getCurrentPage()).toBe(1);
        expect(onRowActivated).not.toHaveBeenCalled();
    });

    it("switches the innermost notebook when its tab is nested in another notebook", async () => {
        const outerRef = createRef<Gtk.Notebook>();

        const { notebook } = await renderFixture((book) => (
            <GtkNotebook ref={outerRef}>
                <GtkNotebookPage tabLabel="Outer one">{book}</GtkNotebookPage>
                <GtkNotebookPage tabLabel="Outer two">
                    <GtkLabel>Outer body</GtkLabel>
                </GtkNotebookPage>
            </GtkNotebook>
        ));

        await userEvent.click(screen.getByText("Tab three"));
        expect(notebook.getCurrentPage()).toBe(2);
        expect(outerRef.current?.getCurrentPage()).toBe(0);
    });
});
