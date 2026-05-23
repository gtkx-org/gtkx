import type * as Gtk from "@gtkx/ffi/gtk";
import { GtkLabel, GtkNotebook } from "@gtkx/react";
import { render } from "@gtkx/testing";
import { createRef, type RefObject } from "react";
import { describe, expect, it } from "vitest";
import { renderChildren } from "../helpers/render-children.js";

const buildNotebook = (ref: RefObject<Gtk.Notebook | null>) => (pages: string[]) => (
    <GtkNotebook ref={ref}>
        {pages.map((label) => (
            <GtkNotebook.Page key={label} label={label}>
                {label}
            </GtkNotebook.Page>
        ))}
    </GtkNotebook>
);

describe("render - NotebookPage > NotebookPageNode (1)", () => {
    it("adds page to Notebook", async () => {
        const notebookRef = createRef<Gtk.Notebook>();

        await render(
            <GtkNotebook ref={notebookRef}>
                <GtkNotebook.Page label="Page 1">Content 1</GtkNotebook.Page>
            </GtkNotebook>,
        );

        expect(notebookRef.current?.getNPages()).toBe(1);
    });

    it("sets page tab label", async () => {
        const notebookRef = createRef<Gtk.Notebook>();
        const contentRef = createRef<Gtk.Label>();

        await render(
            <GtkNotebook ref={notebookRef}>
                <GtkNotebook.Page label="My Tab">
                    <GtkLabel ref={contentRef} label="Content" />
                </GtkNotebook.Page>
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

        function App({ tabLabel }: { tabLabel: string }) {
            return (
                <GtkNotebook ref={notebookRef}>
                    <GtkNotebook.Page label={tabLabel}>
                        <GtkLabel ref={contentRef} label="Content" />
                    </GtkNotebook.Page>
                </GtkNotebook>
            );
        }

        await render(<App tabLabel="Initial" />);
        let tabLabel = notebookRef.current?.getTabLabel(contentRef.current as Gtk.Widget) as Gtk.Label;
        expect(tabLabel?.getLabel()).toBe("Initial");

        await render(<App tabLabel="Updated" />);
        tabLabel = notebookRef.current?.getTabLabel(contentRef.current as Gtk.Widget) as Gtk.Label;
        expect(tabLabel?.getLabel()).toBe("Updated");
    });

    it("adds multiple pages", async () => {
        const notebookRef = createRef<Gtk.Notebook>();

        await render(
            <GtkNotebook ref={notebookRef}>
                <GtkNotebook.Page label="Page 1">Content 1</GtkNotebook.Page>
                <GtkNotebook.Page label="Page 2">Content 2</GtkNotebook.Page>
                <GtkNotebook.Page label="Page 3">Content 3</GtkNotebook.Page>
            </GtkNotebook>,
        );

        expect(notebookRef.current?.getNPages()).toBe(3);
    });

    it("removes page from Notebook", async () => {
        const notebookRef = createRef<Gtk.Notebook>();

        const { rerender } = await renderChildren(["A", "B", "C"], buildNotebook(notebookRef));
        expect(notebookRef.current?.getNPages()).toBe(3);

        await rerender(["A", "C"]);
        expect(notebookRef.current?.getNPages()).toBe(2);
    });
});

describe("render - NotebookPage > NotebookPageNode (3)", () => {
    it("handles page reordering", async () => {
        const notebookRef = createRef<Gtk.Notebook>();

        const { rerender } = await renderChildren(["First", "Second", "Third"], buildNotebook(notebookRef));
        await rerender(["Second", "First", "Third"]);

        expect(notebookRef.current?.getNPages()).toBe(3);
    });
});
