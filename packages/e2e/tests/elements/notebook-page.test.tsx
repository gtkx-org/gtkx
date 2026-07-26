import type * as Gtk from "@gtkx/gi/gtk";
import { GtkLabel, GtkNotebook, GtkNotebookPage } from "@gtkx/jsx/gtk";
import { render } from "@gtkx/testing";
import { createRef } from "react";
import { describe, expect, it } from "vitest";
import { buildPlainNotebook } from "../helpers/notebook-render.js";
import { renderChildren } from "../helpers/render-children.js";

const renderPage = async (pageProps: { tabLabel: string; tabExpand?: boolean; tabFill?: boolean }) => {
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

describe("render - NotebookPage (1)", () => {
    it("adds page to Notebook", async () => {
        const notebookRef = createRef<Gtk.Notebook>();
        await renderChildren(["Page 1"], buildPlainNotebook(notebookRef));
        expect(notebookRef.current?.getNPages()).toBe(1);
    });

    it("sets page tab label", async () => {
        const page = await renderPage({ tabLabel: "My Tab" });
        expect(page?.tabLabel).toBe("My Tab");
    });
});

describe("render - NotebookPage (2)", () => {
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
        expect(page?.tabLabel).toBe("Initial");
        await render(<App labelText="Updated" />);
        page = notebookRef.current?.getPage(contentRef.current as Gtk.Widget);
        expect(page?.tabLabel).toBe("Updated");
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
});

describe("render - NotebookPage (3)", () => {
    it("handles page reordering", async () => {
        const notebookRef = createRef<Gtk.Notebook>();
        const { rerender } = await renderChildren(["First", "Second", "Third"], buildPlainNotebook(notebookRef));
        await rerender(["Second", "First", "Third"]);
        expect(notebookRef.current?.getNPages()).toBe(3);
    });
});

describe("render - NotebookPage (4)", () => {
    it("attaches the page when content is inserted before an existing tab wrapper element", async () => {
        const notebookRef = createRef<Gtk.Notebook>();
        const contentRef = createRef<Gtk.Label>();

        function App({ showContent }: { showContent: boolean }) {
            return (
                <GtkNotebook ref={notebookRef}>
                    <GtkNotebookPage tabLabel="Tab">
                        {showContent ? <GtkLabel ref={contentRef}>Content</GtkLabel> : null}
                    </GtkNotebookPage>
                </GtkNotebook>
            );
        }

        await render(<App showContent={false} />);
        expect(notebookRef.current?.getNPages()).toBe(0);
        await render(<App showContent={true} />);
        expect(notebookRef.current?.getNPages()).toBe(1);
        const page = notebookRef.current?.getPage(contentRef.current as Gtk.Widget);
        expect(page?.tabLabel).toBe("Tab");
    });
});

describe("render - NotebookPage (5)", () => {
    it("applies tabExpand and tabFill page metadata", async () => {
        const page = await renderPage({ tabLabel: "Meta Tab", tabExpand: true, tabFill: false });
        expect(page?.tabExpand).toBe(true);
        expect(page?.tabFill).toBe(false);
    });
});
