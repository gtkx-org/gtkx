import type * as Gtk from "@gtkx/ffi/gtk";
import { GtkLabel, GtkStack } from "@gtkx/react";
import { render } from "@gtkx/testing";
import { createRef } from "react";
import { describe, expect, it } from "vitest";

describe("render - Stack", () => {
    describe("Stack.Root", () => {
        it("creates Stack widget", async () => {
            const ref = createRef<Gtk.Stack>();

            await render(<GtkStack.Root ref={ref} />, { wrapper: false });

            expect(ref.current).not.toBeNull();
        });
    });

    describe("Stack.Page", () => {
        it("adds named page", async () => {
            const stackRef = createRef<Gtk.Stack>();

            await render(
                <GtkStack.Root ref={stackRef}>
                    <GtkStack.Page name="page1">
                        <GtkLabel label="Page 1" />
                    </GtkStack.Page>
                </GtkStack.Root>,
                { wrapper: false },
            );

            expect(stackRef.current?.getChildByName("page1")).not.toBeNull();
        });

        it("adds titled page", async () => {
            const stackRef = createRef<Gtk.Stack>();

            await render(
                <GtkStack.Root ref={stackRef}>
                    <GtkStack.Page title="Page Title" name="titled">
                        <GtkLabel label="Titled Content" />
                    </GtkStack.Page>
                </GtkStack.Root>,
                { wrapper: false },
            );

            const page = stackRef.current?.getPage(stackRef.current.getChildByName("titled") as Gtk.Widget);
            expect(page?.getTitle()).toBe("Page Title");
        });

        it("adds child page (no name/title)", async () => {
            const stackRef = createRef<Gtk.Stack>();

            await render(
                <GtkStack.Root ref={stackRef}>
                    <GtkStack.Page>
                        <GtkLabel label="Unnamed Page" />
                    </GtkStack.Page>
                </GtkStack.Root>,
                { wrapper: false },
            );

            expect(stackRef.current?.getFirstChild()).not.toBeNull();
        });

        it("sets page properties (iconName, needsAttention, etc.)", async () => {
            const stackRef = createRef<Gtk.Stack>();

            await render(
                <GtkStack.Root ref={stackRef}>
                    <GtkStack.Page name="props-test" iconName="dialog-information" needsAttention={true}>
                        <GtkLabel label="With Props" />
                    </GtkStack.Page>
                </GtkStack.Root>,
                { wrapper: false },
            );

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
                    <GtkStack.Root ref={stackRef}>
                        {pages.map((name) => (
                            <GtkStack.Page key={name} name={name}>
                                <GtkLabel label={name} />
                            </GtkStack.Page>
                        ))}
                    </GtkStack.Root>
                );
            }

            await render(<App pages={["first", "last"]} />, { wrapper: false });

            await render(<App pages={["first", "middle", "last"]} />, { wrapper: false });

            expect(stackRef.current?.getChildByName("first")).not.toBeNull();
            expect(stackRef.current?.getChildByName("middle")).not.toBeNull();
            expect(stackRef.current?.getChildByName("last")).not.toBeNull();
        });

        it("removes page", async () => {
            const stackRef = createRef<Gtk.Stack>();

            function App({ pages }: { pages: string[] }) {
                return (
                    <GtkStack.Root ref={stackRef}>
                        {pages.map((name) => (
                            <GtkStack.Page key={name} name={name}>
                                <GtkLabel label={name} />
                            </GtkStack.Page>
                        ))}
                    </GtkStack.Root>
                );
            }

            await render(<App pages={["a", "b", "c"]} />, { wrapper: false });

            await render(<App pages={["a", "c"]} />, { wrapper: false });

            expect(stackRef.current?.getChildByName("a")).not.toBeNull();
            expect(stackRef.current?.getChildByName("b")).toBeNull();
            expect(stackRef.current?.getChildByName("c")).not.toBeNull();
        });

        it("updates page properties when props change", async () => {
            const stackRef = createRef<Gtk.Stack>();

            function App({ iconName }: { iconName: string }) {
                return (
                    <GtkStack.Root ref={stackRef}>
                        <GtkStack.Page name="dynamic" iconName={iconName}>
                            <GtkLabel label="Dynamic" />
                        </GtkStack.Page>
                    </GtkStack.Root>
                );
            }

            await render(<App iconName="dialog-information" />, { wrapper: false });

            const child = stackRef.current?.getChildByName("dynamic");
            let page = stackRef.current?.getPage(child as Gtk.Widget);
            expect(page?.getIconName()).toBe("dialog-information");

            await render(<App iconName="dialog-warning" />, { wrapper: false });

            page = stackRef.current?.getPage(child as Gtk.Widget);
            expect(page?.getIconName()).toBe("dialog-warning");
        });
    });

    describe("visibleChild", () => {
        it("sets visible child by name", async () => {
            const stackRef = createRef<Gtk.Stack>();

            await render(
                <GtkStack.Root ref={stackRef} visibleChildName="page2">
                    <GtkStack.Page name="page1">
                        <GtkLabel label="Page 1" />
                    </GtkStack.Page>
                    <GtkStack.Page name="page2">
                        <GtkLabel label="Page 2" />
                    </GtkStack.Page>
                </GtkStack.Root>,
                { wrapper: false },
            );

            expect(stackRef.current?.getVisibleChildName()).toBe("page2");
        });

        it("handles pending visible child before pages added", async () => {
            const stackRef = createRef<Gtk.Stack>();

            function App({ pages }: { pages: string[] }) {
                return (
                    <GtkStack.Root ref={stackRef} visibleChildName="target">
                        {pages.map((name) => (
                            <GtkStack.Page key={name} name={name}>
                                <GtkLabel label={name} />
                            </GtkStack.Page>
                        ))}
                    </GtkStack.Root>
                );
            }

            await render(<App pages={["other"]} />, { wrapper: false });

            await render(<App pages={["other", "target"]} />, { wrapper: false });

            expect(stackRef.current?.getVisibleChildName()).toBe("target");
        });
    });
});
