import type * as Gtk from "@gtkx/ffi/gtk";
import { GtkLabel, GtkNotebook, NotebookPage } from "@gtkx/react";
import { render } from "@gtkx/testing";
import { createRef } from "react";
import { describe, expect, it } from "vitest";

const getPageLabels = (notebook: Gtk.Notebook): string[] => {
    const labels: string[] = [];
    const nPages = notebook.getNPages();
    for (let i = 0; i < nPages; i++) {
        const page = notebook.getNthPage(i);
        if (page) {
            const tabLabel = notebook.getTabLabel(page);
            if (tabLabel && "getLabel" in tabLabel && typeof tabLabel.getLabel === "function") {
                labels.push((tabLabel as Gtk.Label).getLabel() ?? "");
            }
        }
    }
    return labels;
};

describe("render - Notebook", () => {
    describe("GtkNotebook", () => {
        it("creates Notebook widget", async () => {
            const ref = createRef<Gtk.Notebook>();

            await render(<GtkNotebook ref={ref} />, { wrapper: false });

            expect(ref.current).not.toBeNull();
        });
    });

    describe("NotebookPage", () => {
        it("adds page with label", async () => {
            const notebookRef = createRef<Gtk.Notebook>();

            await render(
                <GtkNotebook ref={notebookRef}>
                    <NotebookPage label="Tab 1">
                        <GtkLabel label="Page 1 Content" />
                    </NotebookPage>
                </GtkNotebook>,
                { wrapper: false },
            );

            expect(notebookRef.current?.getNPages()).toBe(1);
            const labels = getPageLabels(notebookRef.current as Gtk.Notebook);
            expect(labels).toEqual(["Tab 1"]);
        });
    });

    describe("page management", () => {
        it("inserts page before existing page", async () => {
            const notebookRef = createRef<Gtk.Notebook>();

            function App({ pages }: { pages: string[] }) {
                return (
                    <GtkNotebook ref={notebookRef}>
                        {pages.map((label) => (
                            <NotebookPage key={label} label={label}>
                                <GtkLabel label={`Content: ${label}`} />
                            </NotebookPage>
                        ))}
                    </GtkNotebook>
                );
            }

            await render(<App pages={["First", "Last"]} />, { wrapper: false });

            await render(<App pages={["First", "Middle", "Last"]} />, { wrapper: false });

            const labels = getPageLabels(notebookRef.current as Gtk.Notebook);
            expect(labels).toEqual(["First", "Middle", "Last"]);
        });

        it("removes page", async () => {
            const notebookRef = createRef<Gtk.Notebook>();

            function App({ pages }: { pages: string[] }) {
                return (
                    <GtkNotebook ref={notebookRef}>
                        {pages.map((label) => (
                            <NotebookPage key={label} label={label}>
                                <GtkLabel label={`Content: ${label}`} />
                            </NotebookPage>
                        ))}
                    </GtkNotebook>
                );
            }

            await render(<App pages={["A", "B", "C"]} />, { wrapper: false });

            await render(<App pages={["A", "C"]} />, { wrapper: false });

            const labels = getPageLabels(notebookRef.current as Gtk.Notebook);
            expect(labels).toEqual(["A", "C"]);
        });

        it("updates tab label when prop changes", async () => {
            const notebookRef = createRef<Gtk.Notebook>();

            function App({ label }: { label: string }) {
                return (
                    <GtkNotebook ref={notebookRef}>
                        <NotebookPage label={label}>
                            <GtkLabel label="Content" />
                        </NotebookPage>
                    </GtkNotebook>
                );
            }

            await render(<App label="Initial" />, { wrapper: false });

            expect(getPageLabels(notebookRef.current as Gtk.Notebook)).toEqual(["Initial"]);

            await render(<App label="Updated" />, { wrapper: false });

            expect(getPageLabels(notebookRef.current as Gtk.Notebook)).toEqual(["Updated"]);
        });
    });
});
