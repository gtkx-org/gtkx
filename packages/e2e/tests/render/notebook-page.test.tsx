import { isObjectEqual } from "@gtkx/ffi";
import type * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkLabel, GtkNotebook, x } from "@gtkx/react";
import { render } from "@gtkx/testing";
import { createRef } from "react";
import { describe, expect, it } from "vitest";

describe("render - NotebookPage", () => {
    describe("NotebookPageNode", () => {
        it("adds page to Notebook", async () => {
            const notebookRef = createRef<Gtk.Notebook>();

            await render(
                <GtkNotebook ref={notebookRef}>
                    <x.NotebookPage label="Page 1">Content 1</x.NotebookPage>
                </GtkNotebook>,
            );

            expect(notebookRef.current?.getNPages()).toBe(1);
        });

        it("sets page tab label", async () => {
            const notebookRef = createRef<Gtk.Notebook>();
            const contentRef = createRef<Gtk.Label>();

            await render(
                <GtkNotebook ref={notebookRef}>
                    <x.NotebookPage label="My Tab">
                        <GtkLabel ref={contentRef} label="Content" />
                    </x.NotebookPage>
                </GtkNotebook>,
            );

            const tabLabel = notebookRef.current?.getTabLabel(contentRef.current as Gtk.Widget) as Gtk.Label;
            expect(tabLabel?.getLabel()).toBe("My Tab");
        });

        it("updates tab label on prop change", async () => {
            const notebookRef = createRef<Gtk.Notebook>();
            const contentRef = createRef<Gtk.Label>();

            function App({ tabLabel }: { tabLabel: string }) {
                return (
                    <GtkNotebook ref={notebookRef}>
                        <x.NotebookPage label={tabLabel}>
                            <GtkLabel ref={contentRef} label="Content" />
                        </x.NotebookPage>
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
                    <x.NotebookPage label="Page 1">Content 1</x.NotebookPage>
                    <x.NotebookPage label="Page 2">Content 2</x.NotebookPage>
                    <x.NotebookPage label="Page 3">Content 3</x.NotebookPage>
                </GtkNotebook>,
            );

            expect(notebookRef.current?.getNPages()).toBe(3);
        });

        it("removes page from Notebook", async () => {
            const notebookRef = createRef<Gtk.Notebook>();

            function App({ pages }: { pages: string[] }) {
                return (
                    <GtkNotebook ref={notebookRef}>
                        {pages.map((label) => (
                            <x.NotebookPage key={label} label={label}>
                                {label}
                            </x.NotebookPage>
                        ))}
                    </GtkNotebook>
                );
            }

            await render(<App pages={["A", "B", "C"]} />);
            expect(notebookRef.current?.getNPages()).toBe(3);

            await render(<App pages={["A", "C"]} />);
            expect(notebookRef.current?.getNPages()).toBe(2);
        });

        it("handles page reordering", async () => {
            const notebookRef = createRef<Gtk.Notebook>();

            function App({ pages }: { pages: string[] }) {
                return (
                    <GtkNotebook ref={notebookRef}>
                        {pages.map((label) => (
                            <x.NotebookPage key={label} label={label}>
                                {label}
                            </x.NotebookPage>
                        ))}
                    </GtkNotebook>
                );
            }

            await render(<App pages={["First", "Second", "Third"]} />);
            await render(<App pages={["Second", "First", "Third"]} />);

            expect(notebookRef.current?.getNPages()).toBe(3);
        });
    });

    describe("Notebook.Page (new export)", () => {
        it("works with Notebook.Page export", async () => {
            const notebookRef = createRef<Gtk.Notebook>();
            const contentRef = createRef<Gtk.Label>();

            await render(
                <GtkNotebook ref={notebookRef}>
                    <x.NotebookPage label="My Tab">
                        <GtkLabel ref={contentRef} label="Content" />
                    </x.NotebookPage>
                </GtkNotebook>,
            );

            expect(notebookRef.current?.getNPages()).toBe(1);
            const tabLabel = notebookRef.current?.getTabLabel(contentRef.current as Gtk.Widget) as Gtk.Label;
            expect(tabLabel?.getLabel()).toBe("My Tab");
        });
    });

    describe("Notebook.PageTab", () => {
        it("sets custom widget as tab label", async () => {
            const notebookRef = createRef<Gtk.Notebook>();
            const contentRef = createRef<Gtk.Label>();
            const tabRef = createRef<Gtk.Box>();

            await render(
                <GtkNotebook ref={notebookRef}>
                    <x.NotebookPage>
                        <x.NotebookPageTab>
                            <GtkBox ref={tabRef}>
                                <GtkLabel label="Custom Tab" />
                            </GtkBox>
                        </x.NotebookPageTab>
                        <GtkLabel ref={contentRef} label="Content" />
                    </x.NotebookPage>
                </GtkNotebook>,
            );

            expect(notebookRef.current?.getNPages()).toBe(1);
            const tabLabel = notebookRef.current?.getTabLabel(contentRef.current as Gtk.Widget);
            expect(tabLabel && tabRef.current && isObjectEqual(tabLabel, tabRef.current)).toBe(true);
        });

        it("uses custom tab when both label prop and PageTab are provided", async () => {
            const notebookRef = createRef<Gtk.Notebook>();
            const contentRef = createRef<Gtk.Label>();
            const tabRef = createRef<Gtk.Label>();

            await render(
                <GtkNotebook ref={notebookRef}>
                    <x.NotebookPage label="Ignored Label">
                        <x.NotebookPageTab>
                            <GtkLabel ref={tabRef} label="Custom Tab Wins" />
                        </x.NotebookPageTab>
                        <GtkLabel ref={contentRef} label="Content" />
                    </x.NotebookPage>
                </GtkNotebook>,
            );

            const tabLabel = notebookRef.current?.getTabLabel(contentRef.current as Gtk.Widget);
            expect(tabLabel && tabRef.current && isObjectEqual(tabLabel, tabRef.current)).toBe(true);
            expect((tabLabel as Gtk.Label)?.getLabel()).toBe("Custom Tab Wins");
        });

        it("updates tab widget dynamically", async () => {
            const notebookRef = createRef<Gtk.Notebook>();
            const contentRef = createRef<Gtk.Label>();
            const tabRef = createRef<Gtk.Label>();

            function App({ tabText }: { tabText: string }) {
                return (
                    <GtkNotebook ref={notebookRef}>
                        <x.NotebookPage>
                            <x.NotebookPageTab>
                                <GtkLabel ref={tabRef} label={tabText} />
                            </x.NotebookPageTab>
                            <GtkLabel ref={contentRef} label="Content" />
                        </x.NotebookPage>
                    </GtkNotebook>
                );
            }

            await render(<App tabText="Initial" />);
            let tabLabel = notebookRef.current?.getTabLabel(contentRef.current as Gtk.Widget) as Gtk.Label;
            expect(tabLabel?.getLabel()).toBe("Initial");

            await render(<App tabText="Updated" />);
            tabLabel = notebookRef.current?.getTabLabel(contentRef.current as Gtk.Widget) as Gtk.Label;
            expect(tabLabel?.getLabel()).toBe("Updated");
        });

        it("works with multiple pages with custom tabs", async () => {
            const notebookRef = createRef<Gtk.Notebook>();
            const content1Ref = createRef<Gtk.Label>();
            const content2Ref = createRef<Gtk.Label>();
            const tab1Ref = createRef<Gtk.Label>();
            const tab2Ref = createRef<Gtk.Label>();

            await render(
                <GtkNotebook ref={notebookRef}>
                    <x.NotebookPage>
                        <x.NotebookPageTab>
                            <GtkLabel ref={tab1Ref} label="Tab 1" />
                        </x.NotebookPageTab>
                        <GtkLabel ref={content1Ref} label="Content 1" />
                    </x.NotebookPage>
                    <x.NotebookPage>
                        <x.NotebookPageTab>
                            <GtkLabel ref={tab2Ref} label="Tab 2" />
                        </x.NotebookPageTab>
                        <GtkLabel ref={content2Ref} label="Content 2" />
                    </x.NotebookPage>
                </GtkNotebook>,
            );

            expect(notebookRef.current?.getNPages()).toBe(2);
            const tab1Label = notebookRef.current?.getTabLabel(content1Ref.current as Gtk.Widget);
            const tab2Label = notebookRef.current?.getTabLabel(content2Ref.current as Gtk.Widget);
            expect(tab1Label && tab1Ref.current && isObjectEqual(tab1Label, tab1Ref.current)).toBe(true);
            expect(tab2Label && tab2Ref.current && isObjectEqual(tab2Label, tab2Ref.current)).toBe(true);
        });

        it("mixes pages with text labels and custom tabs", async () => {
            const notebookRef = createRef<Gtk.Notebook>();
            const content1Ref = createRef<Gtk.Label>();
            const content2Ref = createRef<Gtk.Label>();
            const customTabRef = createRef<Gtk.Box>();

            await render(
                <GtkNotebook ref={notebookRef}>
                    <x.NotebookPage label="Text Tab">
                        <GtkLabel ref={content1Ref} label="Content 1" />
                    </x.NotebookPage>
                    <x.NotebookPage>
                        <x.NotebookPageTab>
                            <GtkBox ref={customTabRef}>
                                <GtkLabel label="Custom" />
                            </GtkBox>
                        </x.NotebookPageTab>
                        <GtkLabel ref={content2Ref} label="Content 2" />
                    </x.NotebookPage>
                </GtkNotebook>,
            );

            expect(notebookRef.current?.getNPages()).toBe(2);

            const tab1 = notebookRef.current?.getTabLabel(content1Ref.current as Gtk.Widget) as Gtk.Label;
            expect(tab1?.getLabel()).toBe("Text Tab");

            const tab2 = notebookRef.current?.getTabLabel(content2Ref.current as Gtk.Widget);
            expect(tab2 && customTabRef.current && isObjectEqual(tab2, customTabRef.current)).toBe(true);
        });
    });
});
