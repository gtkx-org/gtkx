import type * as Gtk from "@gtkx/ffi/gtk";
import { GtkLabel, GtkStack, StackPage } from "@gtkx/react";
import { render } from "@gtkx/testing";
import { createRef } from "react";
import { describe, expect, it } from "vitest";

describe("render - Stack", () => {
    describe("GtkStack", () => {
        it("creates Stack widget", async () => {
            const ref = createRef<Gtk.Stack>();

            await render(<GtkStack ref={ref} />, { wrapper: false });

            expect(ref.current).not.toBeNull();
        });
    });

    describe("StackPage", () => {
        it("adds named page", async () => {
            const stackRef = createRef<Gtk.Stack>();

            await render(
                <GtkStack ref={stackRef}>
                    <StackPage name="page1">Page 1</StackPage>
                </GtkStack>,
                { wrapper: false },
            );

            expect(stackRef.current?.getChildByName("page1")).not.toBeNull();
        });

        it("adds titled page", async () => {
            const stackRef = createRef<Gtk.Stack>();

            await render(
                <GtkStack ref={stackRef}>
                    <StackPage title="Page Title" name="titled">
                        Titled Content
                    </StackPage>
                </GtkStack>,
                { wrapper: false },
            );

            const page = stackRef.current?.getPage(stackRef.current.getChildByName("titled") as Gtk.Widget);
            expect(page?.getTitle()).toBe("Page Title");
        });

        it("adds child page (no name/title)", async () => {
            const stackRef = createRef<Gtk.Stack>();

            await render(
                <GtkStack ref={stackRef}>
                    <StackPage>Unnamed Page</StackPage>
                </GtkStack>,
                { wrapper: false },
            );

            expect(stackRef.current?.getFirstChild()).not.toBeNull();
        });

        it("sets page properties (iconName, needsAttention, etc.)", async () => {
            const stackRef = createRef<Gtk.Stack>();

            await render(
                <GtkStack ref={stackRef}>
                    <StackPage name="props-test" iconName="dialog-information" needsAttention={true}>
                        With Props
                    </StackPage>
                </GtkStack>,
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
                    <GtkStack ref={stackRef}>
                        {pages.map((name) => (
                            <StackPage key={name} name={name}>
                                {name}
                            </StackPage>
                        ))}
                    </GtkStack>
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
                    <GtkStack ref={stackRef}>
                        {pages.map((name) => (
                            <StackPage key={name} name={name}>
                                {name}
                            </StackPage>
                        ))}
                    </GtkStack>
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
                    <GtkStack ref={stackRef}>
                        <StackPage name="dynamic" iconName={iconName}>
                            Dynamic
                        </StackPage>
                    </GtkStack>
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
                <GtkStack ref={stackRef} visibleChildName="page2">
                    <StackPage name="page1">Page 1</StackPage>
                    <StackPage name="page2">Page 2</StackPage>
                </GtkStack>,
                { wrapper: false },
            );

            expect(stackRef.current?.getVisibleChildName()).toBe("page2");
        });

        it("handles pending visible child before pages added", async () => {
            const stackRef = createRef<Gtk.Stack>();

            function App({ pages }: { pages: string[] }) {
                return (
                    <GtkStack ref={stackRef} visibleChildName="target">
                        {pages.map((name) => (
                            <StackPage key={name} name={name}>
                                <GtkLabel label={name} />
                            </StackPage>
                        ))}
                    </GtkStack>
                );
            }

            await render(<App pages={["other"]} />, { wrapper: false });

            await render(<App pages={["other", "target"]} />, { wrapper: false });

            expect(stackRef.current?.getVisibleChildName()).toBe("target");
        });
    });
});
