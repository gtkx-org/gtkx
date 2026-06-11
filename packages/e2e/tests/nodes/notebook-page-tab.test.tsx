import type * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkLabel, GtkNotebook, GtkNotebookPage } from "@gtkx/jsx/gtk";
import { render } from "@gtkx/testing";
import { createRef, type ReactNode, type Ref } from "react";
import { describe, expect, it } from "vitest";

function SingleTabPage(props: {
    notebookRef: Ref<Gtk.Notebook>;
    contentRef: Ref<Gtk.Label>;
    tabLabel?: ReactNode;
    label?: string;
    tabExpand?: boolean;
    tabFill?: boolean;
}): ReactNode {
    const { notebookRef, contentRef, ...pageProps } = props;
    return (
        <GtkNotebook ref={notebookRef}>
            <GtkNotebookPage {...pageProps}>
                <GtkLabel ref={contentRef} label="Content" />
            </GtkNotebookPage>
        </GtkNotebook>
    );
}

describe("render - NotebookPageTab > NotebookPageTabNode (1)", () => {
    it("sets custom widget as tab label", async () => {
        const notebookRef = createRef<Gtk.Notebook>();
        const contentRef = createRef<Gtk.Label>();
        const tabRef = createRef<Gtk.Box>();

        await render(
            <GtkNotebook ref={notebookRef}>
                <GtkNotebookPage
                    tabLabel={
                        <GtkBox ref={tabRef}>
                            <GtkLabel label="Custom Tab" />
                        </GtkBox>
                    }
                >
                    <GtkLabel ref={contentRef} label="Content" />
                </GtkNotebookPage>
            </GtkNotebook>,
        );

        expect(notebookRef.current?.getNPages()).toBe(1);
        const tabLabel = notebookRef.current?.getTabLabel(contentRef.current as Gtk.Widget);
        expect(tabLabel && tabRef.current && tabLabel === tabRef.current).toBe(true);
    });

    it("uses custom tab when both label prop and tabLabel are provided", async () => {
        const notebookRef = createRef<Gtk.Notebook>();
        const contentRef = createRef<Gtk.Label>();
        const tabRef = createRef<Gtk.Label>();

        await render(
            <GtkNotebook ref={notebookRef}>
                <GtkNotebookPage label="Ignored Label" tabLabel={<GtkLabel ref={tabRef} label="Custom Tab Wins" />}>
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

        await render(
            <SingleTabPage
                notebookRef={notebookRef}
                contentRef={contentRef}
                tabLabel={<GtkLabel ref={tabRef} label="Initial" />}
            />,
        );
        let tabLabel = notebookRef.current?.getTabLabel(contentRef.current as Gtk.Widget) as Gtk.Label;
        expect(tabLabel?.getLabel()).toBe("Initial");

        await render(
            <SingleTabPage
                notebookRef={notebookRef}
                contentRef={contentRef}
                tabLabel={<GtkLabel ref={tabRef} label="Updated" />}
            />,
        );
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
                <GtkNotebookPage tabLabel={<GtkLabel ref={tab1Ref} label="Tab 1" />}>
                    <GtkLabel ref={content1Ref} label="Content 1" />
                </GtkNotebookPage>
                <GtkNotebookPage tabLabel={<GtkLabel ref={tab2Ref} label="Tab 2" />}>
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
                <GtkNotebookPage
                    tabLabel={
                        <GtkBox ref={customTabRef}>
                            <GtkLabel label="Custom" />
                        </GtkBox>
                    }
                >
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

describe("render - NotebookPageTab > NotebookPageTabNode (5)", () => {
    it("renders a custom component tab label and updates it when its prop changes", async () => {
        const notebookRef = createRef<Gtk.Notebook>();
        const contentRef = createRef<Gtk.Label>();
        const tabRef = createRef<Gtk.Label>();

        function CustomTab({ text }: { text: string }) {
            return <GtkLabel ref={tabRef} label={text} />;
        }

        await render(
            <SingleTabPage
                notebookRef={notebookRef}
                contentRef={contentRef}
                tabLabel={<CustomTab text="From Component" />}
            />,
        );
        let tabLabel = notebookRef.current?.getTabLabel(contentRef.current as Gtk.Widget);
        expect(tabLabel && tabRef.current && tabLabel === tabRef.current).toBe(true);
        expect((tabLabel as Gtk.Label)?.getLabel()).toBe("From Component");

        await render(
            <SingleTabPage
                notebookRef={notebookRef}
                contentRef={contentRef}
                tabLabel={<CustomTab text="Component Updated" />}
            />,
        );
        tabLabel = notebookRef.current?.getTabLabel(contentRef.current as Gtk.Widget);
        expect(tabLabel && tabRef.current && tabLabel === tabRef.current).toBe(true);
        expect((tabLabel as Gtk.Label)?.getLabel()).toBe("Component Updated");
    });

    it("renders a default string tab label and updates it in place", async () => {
        const notebookRef = createRef<Gtk.Notebook>();
        const contentRef = createRef<Gtk.Label>();

        await render(<SingleTabPage notebookRef={notebookRef} contentRef={contentRef} label="String Tab" />);
        let tabLabel = notebookRef.current?.getTabLabel(contentRef.current as Gtk.Widget) as Gtk.Label;
        const firstTab = tabLabel;
        expect(tabLabel?.getLabel()).toBe("String Tab");

        await render(<SingleTabPage notebookRef={notebookRef} contentRef={contentRef} label="String Tab Updated" />);
        tabLabel = notebookRef.current?.getTabLabel(contentRef.current as Gtk.Widget) as Gtk.Label;
        expect(tabLabel).toBe(firstTab);
        expect(tabLabel?.getLabel()).toBe("String Tab Updated");
    });
});

describe("render - NotebookPageTab > NotebookPageTabNode (6)", () => {
    it("applies tabExpand and tabFill page metadata", async () => {
        const notebookRef = createRef<Gtk.Notebook>();
        const contentRef = createRef<Gtk.Label>();

        await render(
            <SingleTabPage
                notebookRef={notebookRef}
                contentRef={contentRef}
                label="Meta Tab"
                tabExpand
                tabFill={false}
            />,
        );

        const page = notebookRef.current?.getPage(contentRef.current as Gtk.Widget);
        expect(page?.tabExpand).toBe(true);
        expect(page?.tabFill).toBe(false);
    });
});
