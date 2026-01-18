import type * as Adw from "@gtkx/ffi/adw";
import { AdwNavigationView, GtkLabel, x } from "@gtkx/react";
import { render, screen, waitFor } from "@gtkx/testing";
import { createRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";

describe("render - NavigationView", () => {
    describe("NavigationViewNode", () => {
        it("creates NavigationView widget", async () => {
            const ref = createRef<Adw.NavigationView>();

            await render(<AdwNavigationView ref={ref} />);

            expect(ref.current).not.toBeNull();
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
