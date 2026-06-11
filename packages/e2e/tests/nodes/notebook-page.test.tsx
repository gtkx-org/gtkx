import type * as Gtk from "@gtkx/gi/gtk";
import { GtkLabel, GtkNotebook, GtkNotebookPage } from "@gtkx/jsx/gtk";
import { render } from "@gtkx/testing";
import { createRef } from "react";
import { describe, expect, it } from "vitest";
import { buildPlainNotebook } from "../helpers/notebook-render.js";
import { renderChildren } from "../helpers/render-children.js";

describe("render - NotebookPage > NotebookPageNode (1)", () => {
    it("adds page to Notebook", async () => {
        const notebookRef = createRef<Gtk.Notebook>();

        await render(
            <GtkNotebook ref={notebookRef}>
                <GtkNotebookPage label="Page 1">Content 1</GtkNotebookPage>
            </GtkNotebook>,
        );

        expect(notebookRef.current?.getNPages()).toBe(1);
    });

    it("sets page tab label", async () => {
        const notebookRef = createRef<Gtk.Notebook>();
        const contentRef = createRef<Gtk.Label>();

        await render(
            <GtkNotebook ref={notebookRef}>
                <GtkNotebookPage label="My Tab">
                    <GtkLabel ref={contentRef} label="Content" />
                </GtkNotebookPage>
            </GtkNotebook>,
        );

        const tabLabel = notebookRef.current?.getTabLabel(contentRef.current as Gtk.Widget) as Gtk.Label;
        expect(tabLabel?.getLabel()).toBe("My Tab");
    });
});

describe("render - NotebookPage > NotebookPageNode (2)", () => {
    it("updates tab label on prop change", async () => {
        const notebookRef = createRef<Gtk.Notebook>();
        const contentRef = createRef<Gtk.Label>();

        function App({ labelText }: { labelText: string }) {
            return (
                <GtkNotebook ref={notebookRef}>
                    <GtkNotebookPage label={labelText}>
                        <GtkLabel ref={contentRef} label="Content" />
                    </GtkNotebookPage>
                </GtkNotebook>
            );
        }

        await render(<App labelText="Initial" />);
        let tabLabel = notebookRef.current?.getTabLabel(contentRef.current as Gtk.Widget) as Gtk.Label;
        expect(tabLabel?.getLabel()).toBe("Initial");

        await render(<App labelText="Updated" />);
        tabLabel = notebookRef.current?.getTabLabel(contentRef.current as Gtk.Widget) as Gtk.Label;
        expect(tabLabel?.getLabel()).toBe("Updated");
    });

    it("adds multiple pages", async () => {
        const notebookRef = createRef<Gtk.Notebook>();

        await render(
            <GtkNotebook ref={notebookRef}>
                <GtkNotebookPage label="Page 1">Content 1</GtkNotebookPage>
                <GtkNotebookPage label="Page 2">Content 2</GtkNotebookPage>
                <GtkNotebookPage label="Page 3">Content 3</GtkNotebookPage>
            </GtkNotebook>,
        );

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

describe("render - NotebookPage > NotebookPageNode (3)", () => {
    it("handles page reordering", async () => {
        const notebookRef = createRef<Gtk.Notebook>();

        const { rerender } = await renderChildren(["First", "Second", "Third"], buildPlainNotebook(notebookRef));
        await rerender(["Second", "First", "Third"]);

        expect(notebookRef.current?.getNPages()).toBe(3);
    });
});

describe("render - NotebookPage > NotebookPageNode (4)", () => {
    it("attaches the page when content is inserted before an existing tab marker", async () => {
        const notebookRef = createRef<Gtk.Notebook>();
        const contentRef = createRef<Gtk.Label>();

        function App({ showContent }: { showContent: boolean }) {
            return (
                <GtkNotebook ref={notebookRef}>
                    <GtkNotebookPage tabLabel={<GtkLabel label="Tab" />}>
                        {showContent ? <GtkLabel ref={contentRef} label="Content" /> : null}
                    </GtkNotebookPage>
                </GtkNotebook>
            );
        }

        await render(<App showContent={false} />);
        expect(notebookRef.current?.getNPages()).toBe(0);

        await render(<App showContent={true} />);
        expect(notebookRef.current?.getNPages()).toBe(1);
        const tabLabel = notebookRef.current?.getTabLabel(contentRef.current as Gtk.Widget) as Gtk.Label;
        expect(tabLabel?.getLabel()).toBe("Tab");
    });
});
