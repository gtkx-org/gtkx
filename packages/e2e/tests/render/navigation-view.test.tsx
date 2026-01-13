import type * as Adw from "@gtkx/ffi/adw";
import { AdwNavigationView, GtkLabel, x } from "@gtkx/react";
import { render, screen, waitFor } from "@gtkx/testing";
import { createRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";

describe("render - NavigationView", () => {
    describe("AdwNavigationView", () => {
        it("creates NavigationView widget", async () => {
            const ref = createRef<Adw.NavigationView>();

            await render(<AdwNavigationView ref={ref} />);

            expect(ref.current).not.toBeNull();
        });
    });

    describe("NavigationPage", () => {
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
    });

    describe("page management", () => {
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

    describe("history", () => {
        it("sets history via prop", async () => {
            const viewRef = createRef<Adw.NavigationView>();

            await render(
                <AdwNavigationView ref={viewRef} history={["page1", "page2"]}>
                    <x.NavigationPage for={AdwNavigationView} id="page1" title="Page 1">
                        <GtkLabel label="Content 1" />
                    </x.NavigationPage>
                    <x.NavigationPage for={AdwNavigationView} id="page2" title="Page 2">
                        <GtkLabel label="Content 2" />
                    </x.NavigationPage>
                </AdwNavigationView>,
            );

            await waitFor(() => {
                const stack = viewRef.current?.getNavigationStack();
                expect(stack?.getNItems()).toBe(2);
            });
        });

        it("updates history when prop changes", async () => {
            const viewRef = createRef<Adw.NavigationView>();

            function App({ history }: { history: string[] }) {
                return (
                    <AdwNavigationView ref={viewRef} history={history}>
                        <x.NavigationPage for={AdwNavigationView} id="home" title="Home">
                            <GtkLabel label="Home" />
                        </x.NavigationPage>
                        <x.NavigationPage for={AdwNavigationView} id="details" title="Details">
                            <GtkLabel label="Details" />
                        </x.NavigationPage>
                        <x.NavigationPage for={AdwNavigationView} id="settings" title="Settings">
                            <GtkLabel label="Settings" />
                        </x.NavigationPage>
                    </AdwNavigationView>
                );
            }

            await render(<App history={["home"]} />);

            await waitFor(() => {
                const stack = viewRef.current?.getNavigationStack();
                expect(stack?.getNItems()).toBe(1);
            });

            await render(<App history={["home", "details"]} />);

            await waitFor(() => {
                const stack = viewRef.current?.getNavigationStack();
                expect(stack?.getNItems()).toBe(2);
            });
        });
    });

    describe("onHistoryChanged", () => {
        it("connects callback for navigation events", async () => {
            const viewRef = createRef<Adw.NavigationView>();
            const onHistoryChanged = vi.fn();

            await render(
                <AdwNavigationView ref={viewRef} onHistoryChanged={onHistoryChanged}>
                    <x.NavigationPage for={AdwNavigationView} id="page1" title="Page 1">
                        <GtkLabel label="Page 1" />
                    </x.NavigationPage>
                    <x.NavigationPage for={AdwNavigationView} id="page2" title="Page 2">
                        <GtkLabel label="Page 2" />
                    </x.NavigationPage>
                </AdwNavigationView>,
            );

            viewRef.current?.push(viewRef.current.findPage("page2") as Adw.NavigationPage);

            await waitFor(() => {
                expect(onHistoryChanged).toHaveBeenCalled();
            });
        });

        it("removes callback when unmounted", async () => {
            const viewRef = createRef<Adw.NavigationView>();
            const onHistoryChanged = vi.fn();

            function App({ hasCallback }: { hasCallback: boolean }) {
                return (
                    <AdwNavigationView ref={viewRef} onHistoryChanged={hasCallback ? onHistoryChanged : undefined}>
                        <x.NavigationPage for={AdwNavigationView} id="page1" title="Page 1">
                            <GtkLabel label="Page 1" />
                        </x.NavigationPage>
                        <x.NavigationPage for={AdwNavigationView} id="page2" title="Page 2">
                            <GtkLabel label="Page 2" />
                        </x.NavigationPage>
                    </AdwNavigationView>
                );
            }

            await render(<App hasCallback={true} />);

            viewRef.current?.push(viewRef.current.findPage("page2") as Adw.NavigationPage);

            await waitFor(() => {
                expect(onHistoryChanged).toHaveBeenCalled();
            });

            const callCount = onHistoryChanged.mock.calls.length;

            await render(<App hasCallback={false} />);

            viewRef.current?.pop();

            await waitFor(() => {
                const stack = viewRef.current?.getNavigationStack();
                expect(stack?.getNItems()).toBe(1);
            });

            expect(onHistoryChanged.mock.calls.length).toBe(callCount);
        });
    });

    describe("controlled navigation", () => {
        it("handles controlled navigation with state", async () => {
            function NavigationApp() {
                const [history, setHistory] = useState(["home"]);

                return (
                    <AdwNavigationView history={history} onHistoryChanged={setHistory}>
                        <x.NavigationPage for={AdwNavigationView} id="home" title="Home">
                            <GtkLabel label="Home Page" />
                        </x.NavigationPage>
                        <x.NavigationPage for={AdwNavigationView} id="details" title="Details">
                            <GtkLabel label="Details Page" />
                        </x.NavigationPage>
                    </AdwNavigationView>
                );
            }

            await render(<NavigationApp />);

            await screen.findByText("Home Page");
        });
    });
});
