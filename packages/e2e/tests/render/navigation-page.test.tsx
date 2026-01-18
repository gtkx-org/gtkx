import type * as Adw from "@gtkx/ffi/adw";
import { AdwNavigationView, GtkLabel, x } from "@gtkx/react";
import { render, screen } from "@gtkx/testing";
import { createRef } from "react";
import { describe, expect, it } from "vitest";

describe("render - NavigationPage", () => {
    describe("NavigationPageNode", () => {
        it("adds page with id", async () => {
            const viewRef = createRef<Adw.NavigationView>();

            await render(
                <AdwNavigationView ref={viewRef}>
                    <x.NavigationPage for={AdwNavigationView} id="home" title="Home">
                        <GtkLabel label="Home Content" />
                    </x.NavigationPage>
                </AdwNavigationView>,
            );

            await screen.findByText("Home Content");
            expect(viewRef.current?.findPage("home")).not.toBeNull();
        });

        it("adds page with title", async () => {
            await render(
                <AdwNavigationView>
                    <x.NavigationPage for={AdwNavigationView} id="main" title="Main Page">
                        <GtkLabel label="Main Content" />
                    </x.NavigationPage>
                </AdwNavigationView>,
            );

            await screen.findByText("Main Content");
        });

        it("adds multiple pages", async () => {
            const viewRef = createRef<Adw.NavigationView>();

            await render(
                <AdwNavigationView ref={viewRef}>
                    <x.NavigationPage for={AdwNavigationView} id="page1" title="Page 1">
                        <GtkLabel label="Content 1" />
                    </x.NavigationPage>
                    <x.NavigationPage for={AdwNavigationView} id="page2" title="Page 2">
                        <GtkLabel label="Content 2" />
                    </x.NavigationPage>
                </AdwNavigationView>,
            );

            expect(viewRef.current?.findPage("page1")).not.toBeNull();
            expect(viewRef.current?.findPage("page2")).not.toBeNull();
        });

        it("sets canPop property", async () => {
            const viewRef = createRef<Adw.NavigationView>();

            await render(
                <AdwNavigationView ref={viewRef}>
                    <x.NavigationPage for={AdwNavigationView} id="root" title="Root" canPop={false}>
                        <GtkLabel label="Root Page" />
                    </x.NavigationPage>
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
                        <x.NavigationPage for={AdwNavigationView} id="permanent" title="Permanent">
                            <GtkLabel label="Always Here" />
                        </x.NavigationPage>
                        {showPage && (
                            <x.NavigationPage for={AdwNavigationView} id="removable" title="Removable">
                                <GtkLabel label="Maybe Here" />
                            </x.NavigationPage>
                        )}
                    </AdwNavigationView>
                );
            }

            await render(<App showPage={true} />);
            expect(viewRef.current?.findPage("removable")).not.toBeNull();

            await render(<App showPage={false} />);
            expect(viewRef.current?.findPage("removable")).toBeNull();
        });

        it("updates page title when prop changes", async () => {
            const viewRef = createRef<Adw.NavigationView>();

            function App({ title }: { title: string }) {
                return (
                    <AdwNavigationView ref={viewRef}>
                        <x.NavigationPage for={AdwNavigationView} id="dynamic" title={title}>
                            <GtkLabel label="Content" />
                        </x.NavigationPage>
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
                        <x.NavigationPage for={AdwNavigationView} id="page" title="Page" canPop={canPop}>
                            <GtkLabel label="Content" />
                        </x.NavigationPage>
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
});
