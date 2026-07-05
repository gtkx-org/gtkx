import type * as Gtk from "@gtkx/gi/gtk";
import { GtkLabel, GtkStack, GtkStackPage } from "@gtkx/jsx/gtk";
import { render, screen, waitFor } from "@gtkx/testing";
import { createRef, type RefObject, useState } from "react";
import { describe, expect, it } from "vitest";
import { renderChildren } from "../helpers/render-children.js";

const buildIdStack = (ref: RefObject<Gtk.Stack | null>) => (pages: string[]) => (
    <GtkStack ref={ref}>
        {pages.map((name) => (
            <GtkStackPage key={name} name={name}>
                <GtkLabel label={name} />
            </GtkStackPage>
        ))}
    </GtkStack>
);

describe("render - Stack (1)", () => {
    describe("GtkStack", () => {
        it("creates Stack widget", async () => {
            const ref = createRef<Gtk.Stack>();

            await render(<GtkStack ref={ref} />);

            expect(ref.current).not.toBeNull();
        });
    });

    describe("StackPage (1)", () => {
        it("adds named page", async () => {
            await render(
                <GtkStack>
                    <GtkStackPage name="page1">
                        <GtkLabel label="Page 1" />
                    </GtkStackPage>
                </GtkStack>,
            );

            expect(await screen.findByText("Page 1")).toBeDefined();
        });

        it("adds titled page", async () => {
            const stackRef = createRef<Gtk.Stack>();

            await render(
                <GtkStack ref={stackRef}>
                    <GtkStackPage title="Page Title" name="titled">
                        <GtkLabel label="Titled Content" />
                    </GtkStackPage>
                </GtkStack>,
            );

            await screen.findByText("Titled Content");

            const page = stackRef.current?.getPage(stackRef.current.getChildByName("titled") as Gtk.Widget);
            expect(page?.getTitle()).toBe("Page Title");
        });

        it("adds child page (no name/title)", async () => {
            await render(
                <GtkStack>
                    <GtkStackPage>
                        <GtkLabel label="Unnamed Page" />
                    </GtkStackPage>
                </GtkStack>,
            );

            expect(await screen.findByText("Unnamed Page")).toBeDefined();
        });
    });
});

describe("render - Stack (2)", () => {
    describe("StackPage (2)", () => {
        it("sets page properties (iconName, needsAttention, etc.)", async () => {
            const stackRef = createRef<Gtk.Stack>();

            await render(
                <GtkStack ref={stackRef}>
                    <GtkStackPage name="props-test" iconName="dialog-information" needsAttention={true}>
                        <GtkLabel label="With Props" />
                    </GtkStackPage>
                </GtkStack>,
            );

            await screen.findByText("With Props");

            const child = stackRef.current?.getChildByName("props-test");
            const page = stackRef.current?.getPage(child as Gtk.Widget);
            expect(page?.getIconName()).toBe("dialog-information");
            expect(page?.getNeedsAttention()).toBe(true);
        });
    });
});

describe("render - Stack (3)", () => {
    describe("page management", () => {
        it("inserts page before existing page", async () => {
            const stackRef = createRef<Gtk.Stack>();

            const { rerender } = await renderChildren(["first", "last"], buildIdStack(stackRef));

            await rerender(["first", "middle", "last"]);

            expect(stackRef.current?.getChildByName("first")).not.toBeNull();
            expect(stackRef.current?.getChildByName("middle")).not.toBeNull();
            expect(stackRef.current?.getChildByName("last")).not.toBeNull();
        });

        it("removes page", async () => {
            const stackRef = createRef<Gtk.Stack>();

            const { rerender } = await renderChildren(["a", "b", "c"], buildIdStack(stackRef));

            await rerender(["a", "c"]);

            expect(stackRef.current?.getChildByName("a")).not.toBeNull();
            expect(stackRef.current?.getChildByName("b")).toBeNull();
            expect(stackRef.current?.getChildByName("c")).not.toBeNull();
        });

        it("updates page properties when props change", async () => {
            const stackRef = createRef<Gtk.Stack>();

            function App({ iconName }: { iconName: string }) {
                return (
                    <GtkStack ref={stackRef}>
                        <GtkStackPage name="dynamic" iconName={iconName}>
                            <GtkLabel label="Dynamic" />
                        </GtkStackPage>
                    </GtkStack>
                );
            }

            const { rerender } = await render(<App iconName="dialog-information" />);

            const child = stackRef.current?.getChildByName("dynamic");
            let page = stackRef.current?.getPage(child as Gtk.Widget);
            expect(page?.getIconName()).toBe("dialog-information");

            await rerender(<App iconName="dialog-warning" />);

            page = stackRef.current?.getPage(child as Gtk.Widget);
            expect(page?.getIconName()).toBe("dialog-warning");
        });
    });
});

describe("render - Stack (4)", () => {
    describe("visibleChild", () => {
        it("sets visible child by name", async () => {
            const stackRef = createRef<Gtk.Stack>();

            await render(
                <GtkStack ref={stackRef} visibleChildName="page2">
                    <GtkStackPage name="page1">
                        <GtkLabel label="Page 1 Content" />
                    </GtkStackPage>
                    <GtkStackPage name="page2">
                        <GtkLabel label="Page 2 Content" />
                    </GtkStackPage>
                </GtkStack>,
            );

            expect(stackRef.current?.getVisibleChildName()).toBe("page2");
        });

        it("handles pending visible child before pages added", async () => {
            const stackRef = createRef<Gtk.Stack>();

            function App({ pages }: { pages: string[] }) {
                return (
                    <GtkStack ref={stackRef} visibleChildName="target">
                        {pages.map((name) => (
                            <GtkStackPage key={name} name={name}>
                                <GtkLabel label={name} />
                            </GtkStackPage>
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
});

describe("render - Stack (5)", () => {
    describe("page navigation with waitFor", () => {
        it("changes visible page with controlled state", async () => {
            const stackRef = createRef<Gtk.Stack>();

            function NavigableStack() {
                const [page] = useState("page1");
                return (
                    <GtkStack ref={stackRef} visibleChildName={page}>
                        <GtkStackPage name="page1">
                            <GtkLabel label="First Page" />
                        </GtkStackPage>
                        <GtkStackPage name="page2">
                            <GtkLabel label="Second Page" />
                        </GtkStackPage>
                    </GtkStack>
                );
            }

            await render(<NavigableStack />);

            expect(stackRef.current?.getVisibleChildName()).toBe("page1");
        });

        it("finds content in currently visible page", async () => {
            const stackRef = createRef<Gtk.Stack>();

            await render(
                <GtkStack ref={stackRef} visibleChildName="settings">
                    <GtkStackPage name="home">
                        <GtkLabel label="Welcome Home" />
                    </GtkStackPage>
                    <GtkStackPage name="settings">
                        <GtkLabel label="Settings Panel" />
                    </GtkStackPage>
                    <GtkStackPage name="about">
                        <GtkLabel label="About This App" />
                    </GtkStackPage>
                </GtkStack>,
            );

            expect(stackRef.current?.getVisibleChildName()).toBe("settings");
        });
    });
});
