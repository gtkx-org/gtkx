import type * as Gtk from "@gtkx/ffi/gtk";
import { GtkLabel, GtkStack } from "@gtkx/react";
import { render, screen, waitFor } from "@gtkx/testing";
import { createRef, type RefObject, useState } from "react";
import { describe, expect, it } from "vitest";
import { renderChildren } from "../helpers/render-children.js";

const buildIdStack = (ref: RefObject<Gtk.Stack | null>) => (pages: string[]) => (
    <GtkStack ref={ref}>
        {pages.map((name) => (
            <GtkStack.Page key={name} id={name}>
                {name}
            </GtkStack.Page>
        ))}
    </GtkStack>
);

describe("render - Stack (1)", () => {
    describe("GtkStack", () => {
        it("creates Stack widget", { timeout: 10000 }, async () => {
            const ref = createRef<Gtk.Stack>();

            await render(<GtkStack ref={ref} />);

            expect(ref.current).not.toBeNull();
        });
    });

    describe("StackPage (1)", () => {
        it("adds named page", async () => {
            await render(
                <GtkStack>
                    <GtkStack.Page id="page1">Page 1</GtkStack.Page>
                </GtkStack>,
            );

            expect(await screen.findByText("Page 1")).toBeDefined();
        });

        it("adds titled page", async () => {
            const stackRef = createRef<Gtk.Stack>();

            await render(
                <GtkStack ref={stackRef}>
                    <GtkStack.Page title="Page Title" id="titled">
                        Titled Content
                    </GtkStack.Page>
                </GtkStack>,
            );

            await screen.findByText("Titled Content");

            const page = stackRef.current?.getPage(stackRef.current.getChildByName("titled") as Gtk.Widget);
            expect(page?.getTitle()).toBe("Page Title");
        });

        it("adds child page (no name/title)", async () => {
            await render(
                <GtkStack>
                    <GtkStack.Page>Unnamed Page</GtkStack.Page>
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
                    <GtkStack.Page id="props-test" iconName="dialog-information" needsAttention={true}>
                        With Props
                    </GtkStack.Page>
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
                        <GtkStack.Page id="dynamic" iconName={iconName}>
                            Dynamic
                        </GtkStack.Page>
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
});

describe("render - Stack (4)", () => {
    describe("visibleChild", () => {
        it("sets visible child by name", async () => {
            const stackRef = createRef<Gtk.Stack>();

            await render(
                <GtkStack ref={stackRef} page="page2">
                    <GtkStack.Page id="page1">Page 1 Content</GtkStack.Page>
                    <GtkStack.Page id="page2">Page 2 Content</GtkStack.Page>
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
                            <GtkStack.Page key={name} id={name}>
                                <GtkLabel label={name} />
                            </GtkStack.Page>
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
                    <GtkStack ref={stackRef} page={page}>
                        <GtkStack.Page id="page1">First Page</GtkStack.Page>
                        <GtkStack.Page id="page2">Second Page</GtkStack.Page>
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
                    <GtkStack.Page id="home">Welcome Home</GtkStack.Page>
                    <GtkStack.Page id="settings">Settings Panel</GtkStack.Page>
                    <GtkStack.Page id="about">About This App</GtkStack.Page>
                </GtkStack>,
            );

            expect(stackRef.current?.getVisibleChildName()).toBe("settings");
        });
    });
});
