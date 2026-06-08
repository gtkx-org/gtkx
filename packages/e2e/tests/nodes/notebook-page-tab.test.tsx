import type * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkLabel, GtkNotebook, GtkNotebookPage, GtkNotebookPageTab } from "@gtkx/react";
import { render } from "@gtkx/testing";
import { createRef } from "react";
import { describe, expect, it } from "vitest";

describe("render - NotebookPageTab > NotebookPageTabNode (1)", () => {
    it("sets custom widget as tab label", async () => {
        const notebookRef = createRef<Gtk.Notebook>();
        const contentRef = createRef<Gtk.Label>();
        const tabRef = createRef<Gtk.Box>();

        await render(
            <GtkNotebook ref={notebookRef}>
                <GtkNotebookPage>
                    <GtkNotebookPageTab>
                        <GtkBox ref={tabRef}>
                            <GtkLabel label="Custom Tab" />
                        </GtkBox>
                    </GtkNotebookPageTab>
                    <GtkLabel ref={contentRef} label="Content" />
                </GtkNotebookPage>
            </GtkNotebook>,
        );

        expect(notebookRef.current?.getNPages()).toBe(1);
        const tabLabel = notebookRef.current?.getTabLabel(contentRef.current as Gtk.Widget);
        expect(tabLabel && tabRef.current && tabLabel === tabRef.current).toBe(true);
    });

    it("uses custom tab when both label prop and PageTab are provided", async () => {
        const notebookRef = createRef<Gtk.Notebook>();
        const contentRef = createRef<Gtk.Label>();
        const tabRef = createRef<Gtk.Label>();

        await render(
            <GtkNotebook ref={notebookRef}>
                <GtkNotebookPage label="Ignored Label">
                    <GtkNotebookPageTab>
                        <GtkLabel ref={tabRef} label="Custom Tab Wins" />
                    </GtkNotebookPageTab>
                    <GtkLabel ref={contentRef} label="Content" />
                </GtkNotebookPage>
            </GtkNotebook>,
        );

        const tabLabel = notebookRef.current?.getTabLabel(contentRef.current as Gtk.Widget);
        expect(tabLabel && tabRef.current && tabLabel === tabRef.current).toBe(true);
        expect((tabLabel as Gtk.Label)?.getLabel()).toBe("Custom Tab Wins");
    });
});

describe("render - NotebookPageTab > NotebookPageTabNode (2)", () => {
    it("updates tab widget dynamically", async () => {
        const notebookRef = createRef<Gtk.Notebook>();
        const contentRef = createRef<Gtk.Label>();
        const tabRef = createRef<Gtk.Label>();

        function App({ tabText }: { tabText: string }) {
            return (
                <GtkNotebook ref={notebookRef}>
                    <GtkNotebookPage>
                        <GtkNotebookPageTab>
                            <GtkLabel ref={tabRef} label={tabText} />
                        </GtkNotebookPageTab>
                        <GtkLabel ref={contentRef} label="Content" />
                    </GtkNotebookPage>
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
});

describe("render - NotebookPageTab > NotebookPageTabNode (3)", () => {
    it("works with multiple pages with custom tabs", async () => {
        const notebookRef = createRef<Gtk.Notebook>();
        const content1Ref = createRef<Gtk.Label>();
        const content2Ref = createRef<Gtk.Label>();
        const tab1Ref = createRef<Gtk.Label>();
        const tab2Ref = createRef<Gtk.Label>();

        await render(
            <GtkNotebook ref={notebookRef}>
                <GtkNotebookPage>
                    <GtkNotebookPageTab>
                        <GtkLabel ref={tab1Ref} label="Tab 1" />
                    </GtkNotebookPageTab>
                    <GtkLabel ref={content1Ref} label="Content 1" />
                </GtkNotebookPage>
                <GtkNotebookPage>
                    <GtkNotebookPageTab>
                        <GtkLabel ref={tab2Ref} label="Tab 2" />
                    </GtkNotebookPageTab>
                    <GtkLabel ref={content2Ref} label="Content 2" />
                </GtkNotebookPage>
            </GtkNotebook>,
        );

        expect(notebookRef.current?.getNPages()).toBe(2);
        const tab1Label = notebookRef.current?.getTabLabel(content1Ref.current as Gtk.Widget);
        const tab2Label = notebookRef.current?.getTabLabel(content2Ref.current as Gtk.Widget);
        expect(tab1Label && tab1Ref.current && tab1Label === tab1Ref.current).toBe(true);
        expect(tab2Label && tab2Ref.current && tab2Label === tab2Ref.current).toBe(true);
    });
});

describe("render - NotebookPageTab > NotebookPageTabNode (4)", () => {
    it("mixes pages with text labels and custom tabs", async () => {
        const notebookRef = createRef<Gtk.Notebook>();
        const content1Ref = createRef<Gtk.Label>();
        const content2Ref = createRef<Gtk.Label>();
        const customTabRef = createRef<Gtk.Box>();

        await render(
            <GtkNotebook ref={notebookRef}>
                <GtkNotebookPage label="Text Tab">
                    <GtkLabel ref={content1Ref} label="Content 1" />
                </GtkNotebookPage>
                <GtkNotebookPage>
                    <GtkNotebookPageTab>
                        <GtkBox ref={customTabRef}>
                            <GtkLabel label="Custom" />
                        </GtkBox>
                    </GtkNotebookPageTab>
                    <GtkLabel ref={content2Ref} label="Content 2" />
                </GtkNotebookPage>
            </GtkNotebook>,
        );

        expect(notebookRef.current?.getNPages()).toBe(2);

        const tab1 = notebookRef.current?.getTabLabel(content1Ref.current as Gtk.Widget) as Gtk.Label;
        expect(tab1?.getLabel()).toBe("Text Tab");

        const tab2 = notebookRef.current?.getTabLabel(content2Ref.current as Gtk.Widget);
        expect(tab2 && customTabRef.current && tab2 === customTabRef.current).toBe(true);
    });
});
