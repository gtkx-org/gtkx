import type * as Gtk from "@gtkx/ffi/gtk";
import { GtkLabel, GtkStack, x } from "@gtkx/react";
import { render, screen, waitFor } from "@gtkx/testing";
import { createRef, useState } from "react";
import { describe, expect, it } from "vitest";

describe("render - Stack", () => {
    describe("GtkStack", () => {
        it("creates Stack widget", { timeout: 10000 }, async () => {
            const ref = createRef<Gtk.Stack>();

            await render(<GtkStack ref={ref} />);

            expect(ref.current).not.toBeNull();
        });
    });

    describe("StackPage", () => {
        it("adds named page", async () => {
            await render(
                <GtkStack>
                    <x.StackPage id="page1">Page 1</x.StackPage>
                </GtkStack>,
            );

            await screen.findByText("Page 1");
        });

        it("adds titled page", async () => {
            const stackRef = createRef<Gtk.Stack>();

            await render(
                <GtkStack ref={stackRef}>
                    <x.StackPage title="Page Title" id="titled">
                        Titled Content
                    </x.StackPage>
                </GtkStack>,
            );

            await screen.findByText("Titled Content");

            const page = stackRef.current?.getPage(stackRef.current.getChildByName("titled") as Gtk.Widget);
            expect(page?.getTitle()).toBe("Page Title");
        });

        it("adds child page (no name/title)", async () => {
            await render(
                <GtkStack>
                    <x.StackPage>Unnamed Page</x.StackPage>
                </GtkStack>,
            );

            await screen.findByText("Unnamed Page");
        });

        it("sets page properties (iconName, needsAttention, etc.)", async () => {
            const stackRef = createRef<Gtk.Stack>();

            await render(
                <GtkStack ref={stackRef}>
                    <x.StackPage id="props-test" iconName="dialog-information" needsAttention={true}>
                        With Props
                    </x.StackPage>
                </GtkStack>,
            );

            await screen.findByText("With Props");

            const child = stackRef.current?.getChildByName("props-test");
            const page = stackRef.current?.getPage(child as Gtk.Widget);
            expect(page?.getIconName()).toBe("dialog-information");
            expect(page?.getNeedsAttention()).toBe(true);
        });
    });

    describe("page management", () => {
        it("inserts page before existing page", async () => {
            const stackRef = createRef<Gtk.Stack>();

            function App({ pages }: { pages: string[] }) {
                return (
                    <GtkStack ref={stackRef}>
                        {pages.map((name) => (
                            <x.StackPage key={name} id={name}>
                                {name}
                            </x.StackPage>
                        ))}
                    </GtkStack>
                );
            }

            await render(<App pages={["first", "last"]} />);

            await render(<App pages={["first", "middle", "last"]} />);

            expect(stackRef.current?.getChildByName("first")).not.toBeNull();
            expect(stackRef.current?.getChildByName("middle")).not.toBeNull();
            expect(stackRef.current?.getChildByName("last")).not.toBeNull();
        });

        it("removes page", async () => {
            const stackRef = createRef<Gtk.Stack>();

            function App({ pages }: { pages: string[] }) {
                return (
                    <GtkStack ref={stackRef}>
                        {pages.map((name) => (
                            <x.StackPage key={name} id={name}>
                                {name}
                            </x.StackPage>
                        ))}
                    </GtkStack>
                );
            }

            await render(<App pages={["a", "b", "c"]} />);

            await render(<App pages={["a", "c"]} />);

            expect(stackRef.current?.getChildByName("a")).not.toBeNull();
            expect(stackRef.current?.getChildByName("b")).toBeNull();
            expect(stackRef.current?.getChildByName("c")).not.toBeNull();
        });

        it("updates page properties when props change", async () => {
            const stackRef = createRef<Gtk.Stack>();

            function App({ iconName }: { iconName: string }) {
                return (
                    <GtkStack ref={stackRef}>
                        <x.StackPage id="dynamic" iconName={iconName}>
                            Dynamic
                        </x.StackPage>
                    </GtkStack>
                );
            }

            await render(<App iconName="dialog-information" />);

            const child = stackRef.current?.getChildByName("dynamic");
            let page = stackRef.current?.getPage(child as Gtk.Widget);
            expect(page?.getIconName()).toBe("dialog-information");

            await render(<App iconName="dialog-warning" />);

            page = stackRef.current?.getPage(child as Gtk.Widget);
            expect(page?.getIconName()).toBe("dialog-warning");
        });
    });

    describe("visibleChild", () => {
        it("sets visible child by name", async () => {
            const stackRef = createRef<Gtk.Stack>();

            await render(
                <GtkStack ref={stackRef} page="page2">
                    <x.StackPage id="page1">Page 1 Content</x.StackPage>
                    <x.StackPage id="page2">Page 2 Content</x.StackPage>
                </GtkStack>,
            );

            expect(stackRef.current?.getVisibleChildName()).toBe("page2");
        });

        it("handles pending visible child before pages added", async () => {
            const stackRef = createRef<Gtk.Stack>();

            function App({ pages }: { pages: string[] }) {
                return (
                    <GtkStack ref={stackRef} page="target">
                        {pages.map((name) => (
                            <x.StackPage key={name} id={name}>
                                <GtkLabel label={name} />
                            </x.StackPage>
                        ))}
                    </GtkStack>
                );
            }

            const { rerender } = await render(<App pages={["other"]} />);

            await rerender(<App pages={["other", "target"]} />);

            await waitFor(() => {
                expect(stackRef.current?.getVisibleChildName()).toBe("target");
            });
        });
    });

    describe("page navigation with waitFor", () => {
        it("changes visible page with controlled state", async () => {
            const stackRef = createRef<Gtk.Stack>();

            function NavigableStack() {
                const [page] = useState("page1");
                return (
                    <GtkStack ref={stackRef} page={page}>
                        <x.StackPage id="page1">First Page</x.StackPage>
                        <x.StackPage id="page2">Second Page</x.StackPage>
                    </GtkStack>
                );
            }

            await render(<NavigableStack />);

            expect(stackRef.current?.getVisibleChildName()).toBe("page1");
        });

        it("finds content in currently visible page", async () => {
            const stackRef = createRef<Gtk.Stack>();

            await render(
                <GtkStack ref={stackRef} page="settings">
                    <x.StackPage id="home">Welcome Home</x.StackPage>
                    <x.StackPage id="settings">Settings Panel</x.StackPage>
                    <x.StackPage id="about">About This App</x.StackPage>
                </GtkStack>,
            );

            expect(stackRef.current?.getVisibleChildName()).toBe("settings");
        });
    });
});
