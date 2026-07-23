import type * as Gtk from "@gtkx/gi/gtk";
import { GtkLabel, GtkNotebook, GtkNotebookPage, GtkStack, GtkStackPage } from "@gtkx/jsx/gtk";
import { render } from "@gtkx/testing";
import { createRef } from "react";
import { describe, expect, it } from "vitest";

describe("render - page adoption > NotebookPage", () => {
    it("exposes the real Gtk.NotebookPage through ref", async () => {
        const notebookRef = createRef<Gtk.Notebook>();
        const contentRef = createRef<Gtk.Label>();
        const pageRef = createRef<Gtk.NotebookPage>();

        await render(
            <GtkNotebook ref={notebookRef}>
                <GtkNotebookPage ref={pageRef} tabLabel="Page">
                    <GtkLabel ref={contentRef}>Content</GtkLabel>
                </GtkNotebookPage>
            </GtkNotebook>,
        );

        const page = notebookRef.current?.getPage(contentRef.current as Gtk.Widget);
        expect(pageRef.current).toBe(page);
        expect(pageRef.current?.getChild()).toBe(contentRef.current);
    });

    it("applies reorderable, detachable and menuLabel declaratively", async () => {
        const notebookRef = createRef<Gtk.Notebook>();
        const contentRef = createRef<Gtk.Label>();

        await render(
            <GtkNotebook ref={notebookRef}>
                <GtkNotebookPage tabLabel="Page" reorderable detachable menuLabel="Menu Entry">
                    <GtkLabel ref={contentRef}>Content</GtkLabel>
                </GtkNotebookPage>
            </GtkNotebook>,
        );

        const page = notebookRef.current?.getPage(contentRef.current as Gtk.Widget);
        expect(page?.reorderable).toBe(true);
        expect(page?.detachable).toBe(true);
        expect(page?.menuLabel).toBe("Menu Entry");
    });

    it("resets a page prop to its default when it is removed", async () => {
        const notebookRef = createRef<Gtk.Notebook>();
        const contentRef = createRef<Gtk.Label>();

        function App({ reorderable }: { reorderable: boolean }) {
            return (
                <GtkNotebook ref={notebookRef}>
                    <GtkNotebookPage tabLabel="Page" reorderable={reorderable}>
                        <GtkLabel ref={contentRef}>Content</GtkLabel>
                    </GtkNotebookPage>
                </GtkNotebook>
            );
        }

        const { rerender } = await render(<App reorderable={true} />);
        let page = notebookRef.current?.getPage(contentRef.current as Gtk.Widget);
        expect(page?.reorderable).toBe(true);

        await rerender(<App reorderable={false} />);
        page = notebookRef.current?.getPage(contentRef.current as Gtk.Widget);
        expect(page?.reorderable).toBe(false);
    });
});

describe("render - page adoption > StackPage", () => {
    it("exposes the real Gtk.StackPage through ref", async () => {
        const stackRef = createRef<Gtk.Stack>();
        const contentRef = createRef<Gtk.Label>();
        const pageRef = createRef<Gtk.StackPage>();

        await render(
            <GtkStack ref={stackRef}>
                <GtkStackPage ref={pageRef} name="page" title="Title">
                    <GtkLabel ref={contentRef}>Content</GtkLabel>
                </GtkStackPage>
            </GtkStack>,
        );

        const page = stackRef.current?.getPage(contentRef.current as Gtk.Widget);
        expect(pageRef.current).toBe(page);
        expect(pageRef.current?.getTitle()).toBe("Title");
    });
});
