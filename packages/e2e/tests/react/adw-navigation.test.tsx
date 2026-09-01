import type { ReactNode, RefObject } from "react";
import * as Adw from "@gtkx/gi/adw";
import * as Gtk from "@gtkx/gi/gtk";
import {
    AdwNavigationPage,
    AdwNavigationSplitView,
    AdwNavigationView,
    AdwSidebar,
    AdwSidebarItem,
    AdwSidebarSection,
} from "@gtkx/jsx/adw";
import { GtkLabel, GtkNotebook, GtkNotebookPage, GtkStack, GtkStackPage } from "@gtkx/jsx/gtk";
import { render, screen } from "@gtkx/testing";
import { renderChildren } from "@gtkx/testing/internal";
import { createRef } from "react";
import { describe, expect, it } from "vitest";
import { TwoNavigationPages } from "../helpers/navigation-view-render.js";

function ReorderablePageApp({
    notebookRef,
    contentRef,
    isReorderable,
}: {
    notebookRef: RefObject<Gtk.Notebook | null>;
    contentRef: RefObject<Gtk.Label | null>;
    isReorderable: boolean;
}) {
    return (
        <GtkNotebook ref={notebookRef}>
            <GtkNotebookPage tabLabel="Page" reorderable={isReorderable}>
                <GtkLabel ref={contentRef}>Content</GtkLabel>
            </GtkNotebookPage>
        </GtkNotebook>
    );
}

const getItemTitles = (sidebar: Adw.Sidebar | null): string[] => {
    const titles: string[] = [];

    for (let index = 0; ; index += 1) {
        const item = sidebar?.getItem(index) ?? null;

        if (item === null) {
            return titles;
        }

        titles.push(item.getTitle() ?? "");
    }
};

const buildSidebar = (ref: RefObject<Adw.Sidebar | null>) => (titles: string[]) => (
    <AdwSidebar ref={ref}>
        <AdwSidebarSection title="Places">
            {titles.map((title) => (
                <AdwSidebarItem key={title} title={title} />
            ))}
        </AdwSidebarSection>
    </AdwSidebar>
);

const renderSidebar = async (children: ReactNode): Promise<Adw.Sidebar> => {
    const ref = createRef<Adw.Sidebar>();
    await render(<AdwSidebar ref={ref}>{children}</AdwSidebar>);
    const { current } = ref;

    if (!current) {
        throw new TypeError("Expected a Sidebar instance");
    }

    return current;
};

describe("render - NavigationPage", () => {
    it("adds page with id", async () => {
        const viewRef = createRef<Adw.NavigationView>();

        await render(
            <AdwNavigationView ref={viewRef}>
                <AdwNavigationPage tag="home" title="Home">
                    <GtkLabel>Home Content</GtkLabel>
                </AdwNavigationPage>
            </AdwNavigationView>,
        );

        await screen.findByText("Home Content");
        expect(viewRef.current?.findPage("home")).not.toBeNull();
    });

    it("adds page with title", async () => {
        const viewRef = createRef<Adw.NavigationView>();

        await render(
            <AdwNavigationView ref={viewRef}>
                <AdwNavigationPage tag="main" title="Main Page">
                    <GtkLabel>Main Content</GtkLabel>
                </AdwNavigationPage>
            </AdwNavigationView>,
        );

        await screen.findByText("Main Content");
        expect(viewRef.current?.findPage("main")?.getTitle()).toBe("Main Page");
    });

    it("adds multiple pages", async () => {
        const viewRef = createRef<Adw.NavigationView>();

        await render(
            <AdwNavigationView ref={viewRef}>
                <TwoNavigationPages contentPrefix="Content" />
            </AdwNavigationView>,
        );

        expect(viewRef.current?.findPage("page1")).not.toBeNull();
        expect(viewRef.current?.findPage("page2")).not.toBeNull();
    });

    it("sets canPop property", async () => {
        const viewRef = createRef<Adw.NavigationView>();

        await render(
            <AdwNavigationView ref={viewRef}>
                <AdwNavigationPage tag="root" title="Root" canPop={false}>
                    <GtkLabel>Root Page</GtkLabel>
                </AdwNavigationPage>
            </AdwNavigationView>,
        );

        await screen.findByText("Root Page");
        const page = viewRef.current?.findPage("root");
        expect(page).toHaveObjectProperty("canPop", false);
    });

    it("removes page when unmounted", async () => {
        const viewRef = createRef<Adw.NavigationView>();

        function App({ shouldShowPage }: { shouldShowPage: boolean }) {
            return (
                <AdwNavigationView ref={viewRef}>
                    <AdwNavigationPage tag="permanent" title="Permanent">
                        <GtkLabel>Always Here</GtkLabel>
                    </AdwNavigationPage>
                    {shouldShowPage && (
                        <AdwNavigationPage tag="removable" title="Removable">
                            <GtkLabel>Maybe Here</GtkLabel>
                        </AdwNavigationPage>
                    )}
                </AdwNavigationView>
            );
        }

        await render(<App shouldShowPage={true} />);
        expect(viewRef.current?.findPage("removable")).not.toBeNull();
        await render(<App shouldShowPage={false} />);
        expect(viewRef.current?.findPage("removable")).toBeNull();
    });

    it("updates page title when prop changes", async () => {
        const viewRef = createRef<Adw.NavigationView>();

        function App({ title }: { title: string }) {
            return (
                <AdwNavigationView ref={viewRef}>
                    <AdwNavigationPage tag="dynamic" title={title}>
                        <GtkLabel>Content</GtkLabel>
                    </AdwNavigationPage>
                </AdwNavigationView>
            );
        }

        await render(<App title="Initial Title" />);
        let page = viewRef.current?.findPage("dynamic");
        expect(page).toHaveObjectProperty("title", "Initial Title");
        await render(<App title="Updated Title" />);
        page = viewRef.current?.findPage("dynamic");
        expect(page).toHaveObjectProperty("title", "Updated Title");
    });

    it("updates canPop when prop changes", async () => {
        const viewRef = createRef<Adw.NavigationView>();

        function App({ canPop }: { canPop: boolean }) {
            return (
                <AdwNavigationView ref={viewRef}>
                    <AdwNavigationPage tag="page" title="Page" canPop={canPop}>
                        <GtkLabel>Content</GtkLabel>
                    </AdwNavigationPage>
                </AdwNavigationView>
            );
        }

        await render(<App canPop={true} />);
        let page = viewRef.current?.findPage("page");
        expect(page).toHaveObjectProperty("canPop", true);
        await render(<App canPop={false} />);
        page = viewRef.current?.findPage("page");
        expect(page).toHaveObjectProperty("canPop", false);
    });
});

describe("render - NavigationSplitView", () => {
    it("sets the content page", async () => {
        const viewRef = createRef<Adw.NavigationSplitView>();

        await render(
            <AdwNavigationSplitView ref={viewRef}>
                <AdwNavigationPage tag="content" title="Content">
                    <GtkLabel>Split Content</GtkLabel>
                </AdwNavigationPage>
            </AdwNavigationSplitView>,
        );

        await screen.findByText("Split Content");
        expect(viewRef.current?.getContent()).toHaveObjectProperty("tag", "content");
    });

    it("clears the content page when unmounted", async () => {
        const viewRef = createRef<Adw.NavigationSplitView>();

        function App({ shouldShowContent }: { shouldShowContent: boolean }) {
            return (
                <AdwNavigationSplitView ref={viewRef}>
                    {shouldShowContent && (
                        <AdwNavigationPage tag="content" title="Content">
                            <GtkLabel>Split Content</GtkLabel>
                        </AdwNavigationPage>
                    )}
                </AdwNavigationSplitView>
            );
        }

        const { rerender } = await render(<App shouldShowContent={true} />);
        expect(viewRef.current?.getContent()).not.toBeNull();
        await rerender(<App shouldShowContent={false} />);
        expect(viewRef.current?.getContent()).toBeNull();
    });
});

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
        expect(pageRef.current).toHaveObjectProperty("child", contentRef.current);
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
        expect(page).toHaveObjectProperty("reorderable", true);
        expect(page).toHaveObjectProperty("detachable", true);
        expect(page).toHaveObjectProperty("menuLabel", "Menu Entry");
    });

    it("resets a page prop to its default when it is removed", async () => {
        const notebookRef = createRef<Gtk.Notebook>();
        const contentRef = createRef<Gtk.Label>();

        const { rerender } = await render(
            <ReorderablePageApp notebookRef={notebookRef} contentRef={contentRef} isReorderable={true} />,
        );

        let page = notebookRef.current?.getPage(contentRef.current as Gtk.Widget);
        expect(page).toHaveObjectProperty("reorderable", true);

        await rerender(
            <ReorderablePageApp notebookRef={notebookRef} contentRef={contentRef} isReorderable={false} />,
        );

        page = notebookRef.current?.getPage(contentRef.current as Gtk.Widget);
        expect(page).toHaveObjectProperty("reorderable", false);
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
        expect(pageRef.current).toHaveObjectProperty("title", "Title");
    });
});

describe("render - AdwSidebar", () => {
    it("adds sections declared as children", async () => {
        const sidebar = await renderSidebar(
            <>
                <AdwSidebarSection title="Places" />
                <AdwSidebarSection title="Tags" />
            </>,
        );

        expect(sidebar.getSections().getNItems()).toBe(2);
        expect(sidebar.getSection(0)?.getTitle()).toBe("Places");
        expect(sidebar.getSection(1)?.getTitle()).toBe("Tags");
    });

    it("adds items declared as children of a section", async () => {
        const sidebar = await renderSidebar(
            <AdwSidebarSection title="Places">
                <AdwSidebarItem title="Home" />
                <AdwSidebarItem title="Documents" />
            </AdwSidebarSection>,
        );

        expect(getItemTitles(sidebar)).toEqual(["Home", "Documents"]);
        expect(sidebar.getSection(0)?.getItem(0)?.getTitle()).toBe("Home");
    });

    it("removes items when the list shrinks", async () => {
        const ref = createRef<Adw.Sidebar>();
        const { rerender } = await renderChildren(["Home", "Documents"], buildSidebar(ref));
        expect(getItemTitles(ref.current)).toEqual(["Home", "Documents"]);
        await rerender(["Home"]);
        expect(getItemTitles(ref.current)).toEqual(["Home"]);
    });

    it("inserts an item in the middle", async () => {
        const ref = createRef<Adw.Sidebar>();
        const { rerender } = await renderChildren(["Home", "Trash"], buildSidebar(ref));
        await rerender(["Home", "Documents", "Trash"]);
        expect(getItemTitles(ref.current)).toEqual(["Home", "Documents", "Trash"]);
    });
});
