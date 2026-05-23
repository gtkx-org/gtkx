import type * as Adw from "@gtkx/ffi/adw";
import { AdwNavigationView, GtkBox, GtkLabel } from "@gtkx/react";
import { render, screen } from "@gtkx/testing";
import { createElement, createRef } from "react";
import { describe, expect, it } from "vitest";

describe("render - NavigationPage > NavigationPageNode (1)", () => {
    it("adds page with id", async () => {
        const viewRef = createRef<Adw.NavigationView>();

        await render(
            <AdwNavigationView ref={viewRef}>
                <AdwNavigationView.Page id="home" title="Home">
                    <GtkLabel label="Home Content" />
                </AdwNavigationView.Page>
            </AdwNavigationView>,
        );

        await screen.findByText("Home Content");
        expect(viewRef.current?.findPage("home")).not.toBeNull();
    });

    it("adds page with title", async () => {
        await render(
            <AdwNavigationView>
                <AdwNavigationView.Page id="main" title="Main Page">
                    <GtkLabel label="Main Content" />
                </AdwNavigationView.Page>
            </AdwNavigationView>,
        );

        expect(await screen.findByText("Main Content")).toBeDefined();
    });

    it("adds multiple pages", async () => {
        const viewRef = createRef<Adw.NavigationView>();

        await render(
            <AdwNavigationView ref={viewRef}>
                <AdwNavigationView.Page id="page1" title="Page 1">
                    <GtkLabel label="Content 1" />
                </AdwNavigationView.Page>
                <AdwNavigationView.Page id="page2" title="Page 2">
                    <GtkLabel label="Content 2" />
                </AdwNavigationView.Page>
            </AdwNavigationView>,
        );

        expect(viewRef.current?.findPage("page1")).not.toBeNull();
        expect(viewRef.current?.findPage("page2")).not.toBeNull();
    });
});

describe("render - NavigationPage > NavigationPageNode (2)", () => {
    it("sets canPop property", async () => {
        const viewRef = createRef<Adw.NavigationView>();

        await render(
            <AdwNavigationView ref={viewRef}>
                <AdwNavigationView.Page id="root" title="Root" canPop={false}>
                    <GtkLabel label="Root Page" />
                </AdwNavigationView.Page>
            </AdwNavigationView>,
        );

        await screen.findByText("Root Page");
        const page = viewRef.current?.findPage("root");
        expect(page?.getCanPop()).toBe(false);
    });

    it("removes page when unmounted", async () => {
        const viewRef = createRef<Adw.NavigationView>();

        function App({ showPage }: { showPage: boolean }) {
            return (
                <AdwNavigationView ref={viewRef}>
                    <AdwNavigationView.Page id="permanent" title="Permanent">
                        <GtkLabel label="Always Here" />
                    </AdwNavigationView.Page>
                    {showPage && (
                        <AdwNavigationView.Page id="removable" title="Removable">
                            <GtkLabel label="Maybe Here" />
                        </AdwNavigationView.Page>
                    )}
                </AdwNavigationView>
            );
        }

        await render(<App showPage={true} />);
        expect(viewRef.current?.findPage("removable")).not.toBeNull();

        await render(<App showPage={false} />);
        expect(viewRef.current?.findPage("removable")).toBeNull();
    });
});

describe("render - NavigationPage > NavigationPageNode (3)", () => {
    it("updates page title when prop changes", async () => {
        const viewRef = createRef<Adw.NavigationView>();

        function App({ title }: { title: string }) {
            return (
                <AdwNavigationView ref={viewRef}>
                    <AdwNavigationView.Page id="dynamic" title={title}>
                        <GtkLabel label="Content" />
                    </AdwNavigationView.Page>
                </AdwNavigationView>
            );
        }

        await render(<App title="Initial Title" />);
        let page = viewRef.current?.findPage("dynamic");
        expect(page?.getTitle()).toBe("Initial Title");

        await render(<App title="Updated Title" />);
        page = viewRef.current?.findPage("dynamic");
        expect(page?.getTitle()).toBe("Updated Title");
    });

    it("updates canPop when prop changes", async () => {
        const viewRef = createRef<Adw.NavigationView>();

        function App({ canPop }: { canPop: boolean }) {
            return (
                <AdwNavigationView ref={viewRef}>
                    <AdwNavigationView.Page id="page" title="Page" canPop={canPop}>
                        <GtkLabel label="Content" />
                    </AdwNavigationView.Page>
                </AdwNavigationView>
            );
        }

        await render(<App canPop={true} />);
        let page = viewRef.current?.findPage("page");
        expect(page?.getCanPop()).toBe(true);

        await render(<App canPop={false} />);
        page = viewRef.current?.findPage("page");
        expect(page?.getCanPop()).toBe(false);
    });
});

describe("render - NavigationPage > NavigationPageNode (4)", () => {
    it("throws when used inside a parent without a matching slot setter", async () => {
        await expect(
            render(
                <GtkBox>
                    {createElement(
                        "NavigationPage",
                        { id: "non-existent-slot", title: "Orphan" },
                        <GtkLabel label="content" />,
                    )}
                </GtkBox>,
            ),
        ).rejects.toThrow(/Unable to find property for slot 'nonExistentSlot'/);
    });
});
