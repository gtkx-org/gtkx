import type { GtkNotebookPageElementProps } from "@gtkx/jsx/gtk";
import type { ReactNode, RefObject } from "react";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkLabel, GtkListBox, GtkListBoxRow, GtkNotebook, GtkNotebookPage } from "@gtkx/jsx/gtk";
import { getWidgetText, render, screen, userEvent, within } from "@gtkx/testing";
import { renderChildren } from "@gtkx/testing/internal";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { buildLabelNotebook, buildPlainNotebook } from "../helpers/notebook-render.js";

type NotebookPageMetadata = Pick<GtkNotebookPageElementProps, "tabLabel" | "tabExpand" | "tabFill">;
type NotebookFixture = { notebook: Gtk.Notebook; onSwitchPage: ReturnType<typeof vi.fn> };

const TAB_LABELS = ["Tab one", "Tab two", "Tab three"];

const tabLabel = (tab: Gtk.Widget): string => getWidgetText(within(tab).getByRole(Gtk.AccessibleRole.LABEL)) ?? "";

const getPageLabels = (notebook: Gtk.Notebook): string[] =>
    within(notebook)
        .getAllByRole(Gtk.AccessibleRole.TAB)
        .map((tab) => tabLabel(tab));

const renderPage = async (pageProps: NotebookPageMetadata) => {
    const notebookRef = createRef<Gtk.Notebook>();
    const contentRef = createRef<Gtk.Label>();

    await render(
        <GtkNotebook ref={notebookRef}>
            <GtkNotebookPage {...pageProps}>
                <GtkLabel ref={contentRef}>Content</GtkLabel>
            </GtkNotebookPage>
        </GtkNotebook>,
    );

    return notebookRef.current?.getPage(contentRef.current as Gtk.Widget);
};

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

describe("render - Notebook", () => {
    describe("GtkNotebook", () => {
        it("creates Notebook widget", async () => {
            const ref = createRef<Gtk.Notebook>();
            await render(<GtkNotebook ref={ref} />);
            expect(ref.current).not.toBeNull();
        });
    });

    describe("NotebookPage", () => {
        it("adds page with label", async () => {
            const notebookRef = createRef<Gtk.Notebook>();

            await render(
                <GtkNotebook ref={notebookRef}>
                    <GtkNotebookPage tabLabel="Tab 1">
                        <GtkLabel>Page 1 Content</GtkLabel>
                    </GtkNotebookPage>
                </GtkNotebook>,
            );

            const labels = getPageLabels(notebookRef.current as Gtk.Notebook);
            expect(labels).toHaveLength(1);
            expect(labels).toEqual(["Tab 1"]);
        });
    });

    describe("page management", () => {
        it("inserts page before existing page", async () => {
            const notebookRef = createRef<Gtk.Notebook>();
            const { rerender } = await renderChildren(["First", "Last"], buildLabelNotebook(notebookRef));
            await rerender(["First", "Middle", "Last"]);
            const labels = getPageLabels(notebookRef.current as Gtk.Notebook);
            expect(labels).toHaveLength(3);
            expect(labels).toEqual(expect.arrayContaining(["First", "Middle", "Last"]));
        });

        it("removes page", async () => {
            const notebookRef = createRef<Gtk.Notebook>();
            const { rerender } = await renderChildren(["A", "B", "C"], buildLabelNotebook(notebookRef));
            await rerender(["A", "C"]);
            const labels = getPageLabels(notebookRef.current as Gtk.Notebook);
            expect(labels).toEqual(["A", "C"]);
        });

        it("updates tab label when prop changes", async () => {
            const notebookRef = createRef<Gtk.Notebook>();

            function App({ label }: { label: string }) {
                return (
                    <GtkNotebook ref={notebookRef}>
                        <GtkNotebookPage tabLabel={label}>
                            <GtkLabel>Content</GtkLabel>
                        </GtkNotebookPage>
                    </GtkNotebook>
                );
            }

            await render(<App label="Initial" />);
            expect(getPageLabels(notebookRef.current as Gtk.Notebook)).toEqual(["Initial"]);
            await render(<App label="Updated" />);
            expect(getPageLabels(notebookRef.current as Gtk.Notebook)).toEqual(["Updated"]);
        });
    });
});

describe("render - NotebookPage", () => {
    it("adds page to Notebook", async () => {
        const notebookRef = createRef<Gtk.Notebook>();
        await renderChildren(["Page 1"], buildPlainNotebook(notebookRef));
        expect(notebookRef.current?.getNPages()).toBe(1);
    });

    it("sets page tab label", async () => {
        const page = await renderPage({ tabLabel: "My Tab" });
        expect(page).toHaveObjectProperty("tabLabel", "My Tab");
    });

    it("updates tab label on prop change", async () => {
        const notebookRef = createRef<Gtk.Notebook>();
        const contentRef = createRef<Gtk.Label>();

        function App({ labelText }: { labelText: string }) {
            return (
                <GtkNotebook ref={notebookRef}>
                    <GtkNotebookPage tabLabel={labelText}>
                        <GtkLabel ref={contentRef}>Content</GtkLabel>
                    </GtkNotebookPage>
                </GtkNotebook>
            );
        }

        await render(<App labelText="Initial" />);
        let page = notebookRef.current?.getPage(contentRef.current as Gtk.Widget);
        expect(page).toHaveObjectProperty("tabLabel", "Initial");
        await render(<App labelText="Updated" />);
        page = notebookRef.current?.getPage(contentRef.current as Gtk.Widget);
        expect(page).toHaveObjectProperty("tabLabel", "Updated");
    });

    it("adds multiple pages", async () => {
        const notebookRef = createRef<Gtk.Notebook>();
        await renderChildren(["Page 1", "Page 2", "Page 3"], buildPlainNotebook(notebookRef));
        expect(notebookRef.current?.getNPages()).toBe(3);
    });

    it("removes page from Notebook", async () => {
        const notebookRef = createRef<Gtk.Notebook>();
        const { rerender } = await renderChildren(["A", "B", "C"], buildPlainNotebook(notebookRef));
        expect(notebookRef.current?.getNPages()).toBe(3);
        await rerender(["A", "C"]);
        expect(notebookRef.current?.getNPages()).toBe(2);
    });

    it("handles page reordering", async () => {
        const notebookRef = createRef<Gtk.Notebook>();
        const { rerender } = await renderChildren(["First", "Second", "Third"], buildPlainNotebook(notebookRef));
        await rerender(["Second", "First", "Third"]);
        expect(notebookRef.current?.getNPages()).toBe(3);
    });

    it("attaches the page when content is inserted before an existing tab wrapper element", async () => {
        const notebookRef = createRef<Gtk.Notebook>();
        const contentRef = createRef<Gtk.Label>();

        function App({ shouldShowContent }: { shouldShowContent: boolean }) {
            return (
                <GtkNotebook ref={notebookRef}>
                    <GtkNotebookPage tabLabel="Tab">
                        {shouldShowContent ? <GtkLabel ref={contentRef}>Content</GtkLabel> : null}
                    </GtkNotebookPage>
                </GtkNotebook>
            );
        }

        await render(<App shouldShowContent={false} />);
        expect(notebookRef.current?.getNPages()).toBe(0);
        await render(<App shouldShowContent={true} />);
        expect(notebookRef.current?.getNPages()).toBe(1);
        const page = notebookRef.current?.getPage(contentRef.current as Gtk.Widget);
        expect(page).toHaveObjectProperty("tabLabel", "Tab");
    });

    it("applies tabExpand and tabFill page metadata", async () => {
        const page = await renderPage({ tabLabel: "Meta Tab", tabExpand: true, tabFill: false });
        expect(page).toHaveObjectProperty("tabExpand", true);
        expect(page).toHaveObjectProperty("tabFill", false);
    });
});

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
