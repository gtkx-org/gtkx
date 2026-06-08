import type * as Adw from "@gtkx/gi/adw";
import { AdwNavigationPage, AdwNavigationView, GtkLabel } from "@gtkx/react";
import { render, screen } from "@gtkx/testing";
import { createRef } from "react";
import { describe, expect, it } from "vitest";
import { TwoNavigationPages } from "../helpers/navigation-view-render.js";

describe("render - NavigationPage > NavigationPageNode (1)", () => {
    it("adds page with id", async () => {
        const viewRef = createRef<Adw.NavigationView>();

        await render(
            <AdwNavigationView ref={viewRef}>
                <AdwNavigationPage tag="home" title="Home">
                    <GtkLabel label="Home Content" />
                </AdwNavigationPage>
            </AdwNavigationView>,
        );

        await screen.findByText("Home Content");
        expect(viewRef.current?.findPage("home")).not.toBeNull();
    });

    it("adds page with title", async () => {
        await render(
            <AdwNavigationView>
                <AdwNavigationPage tag="main" title="Main Page">
                    <GtkLabel label="Main Content" />
                </AdwNavigationPage>
            </AdwNavigationView>,
        );

        expect(await screen.findByText("Main Content")).toBeDefined();
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
});

describe("render - NavigationPage > NavigationPageNode (2)", () => {
    it("sets canPop property", async () => {
        const viewRef = createRef<Adw.NavigationView>();

        await render(
            <AdwNavigationView ref={viewRef}>
                <AdwNavigationPage tag="root" title="Root" canPop={false}>
                    <GtkLabel label="Root Page" />
                </AdwNavigationPage>
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
                    <AdwNavigationPage tag="permanent" title="Permanent">
                        <GtkLabel label="Always Here" />
                    </AdwNavigationPage>
                    {showPage && (
                        <AdwNavigationPage tag="removable" title="Removable">
                            <GtkLabel label="Maybe Here" />
                        </AdwNavigationPage>
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
                    <AdwNavigationPage tag="dynamic" title={title}>
                        <GtkLabel label="Content" />
                    </AdwNavigationPage>
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
                    <AdwNavigationPage tag="page" title="Page" canPop={canPop}>
                        <GtkLabel label="Content" />
                    </AdwNavigationPage>
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
