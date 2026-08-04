import type * as Gtk from "@gtkx/gi/gtk";
import { GtkLabel, GtkStack, GtkStackPage } from "@gtkx/jsx/gtk";
import { render, screen, waitFor } from "@gtkx/testing";
import { renderChildren } from "@gtkx/testing/internal";
import { createRef, useState } from "react";
import { describe, expect, it } from "vitest";
import { buildNamedPages, pageNamed } from "../helpers/stack-pages.js";

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
                        <GtkLabel>Page 1</GtkLabel>
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
                        <GtkLabel>Titled Content</GtkLabel>
                    </GtkStackPage>
                </GtkStack>,
            );

            await screen.findByText("Titled Content");
            expect(pageNamed(stackRef.current, "titled")).toHaveObjectProperty("title", "Page Title");
        });

        it("adds child page (no name/title)", async () => {
            await render(
                <GtkStack>
                    <GtkStackPage>
                        <GtkLabel>Unnamed Page</GtkLabel>
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
                        <GtkLabel>With Props</GtkLabel>
                    </GtkStackPage>
                </GtkStack>,
            );

            await screen.findByText("With Props");
            const page = pageNamed(stackRef.current, "props-test");
            expect(page).toHaveObjectProperty("iconName", "dialog-information");
            expect(page).toHaveObjectProperty("needsAttention", true);
        });
    });
});

describe("render - Stack (3)", () => {
    describe("page management", () => {
        it("inserts page before existing page", async () => {
            const stackRef = createRef<Gtk.Stack>();
            const { rerender } = await renderChildren(["first", "last"], buildNamedPages(stackRef));
            await rerender(["first", "middle", "last"]);
            expect(stackRef.current?.getChildByName("first")).not.toBeNull();
            expect(stackRef.current?.getChildByName("middle")).not.toBeNull();
            expect(stackRef.current?.getChildByName("last")).not.toBeNull();
        });

        it("removes page", async () => {
            const stackRef = createRef<Gtk.Stack>();
            const { rerender } = await renderChildren(["a", "b", "c"], buildNamedPages(stackRef));
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
                            <GtkLabel>Dynamic</GtkLabel>
                        </GtkStackPage>
                    </GtkStack>
                );
            }

            const { rerender } = await render(<App iconName="dialog-information" />);
            expect(pageNamed(stackRef.current, "dynamic")).toHaveObjectProperty("iconName", "dialog-information");
            await rerender(<App iconName="dialog-warning" />);
            expect(pageNamed(stackRef.current, "dynamic")).toHaveObjectProperty("iconName", "dialog-warning");
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
                        <GtkLabel>Page 1 Content</GtkLabel>
                    </GtkStackPage>
                    <GtkStackPage name="page2">
                        <GtkLabel>Page 2 Content</GtkLabel>
                    </GtkStackPage>
                </GtkStack>,
            );

            expect(stackRef.current).toHaveObjectProperty("visibleChildName", "page2");
        });

        it("handles pending visible child before pages added", async () => {
            const stackRef = createRef<Gtk.Stack>();

            function App({ pages }: { pages: string[] }) {
                return (
                    <GtkStack ref={stackRef} visibleChildName="target">
                        {pages.map((name) => (
                            <GtkStackPage key={name} name={name}>
                                <GtkLabel>{name}</GtkLabel>
                            </GtkStackPage>
                        ))}
                    </GtkStack>
                );
            }

            const { rerender } = await render(<App pages={["other"]} />);
            await rerender(<App pages={["other", "target"]} />);

            await waitFor(() => {
                expect(stackRef.current).toHaveObjectProperty("visibleChildName", "target");
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
                            <GtkLabel>First Page</GtkLabel>
                        </GtkStackPage>
                        <GtkStackPage name="page2">
                            <GtkLabel>Second Page</GtkLabel>
                        </GtkStackPage>
                    </GtkStack>
                );
            }

            await render(<NavigableStack />);
            expect(stackRef.current).toHaveObjectProperty("visibleChildName", "page1");
        });

        it("finds content in currently visible page", async () => {
            const stackRef = createRef<Gtk.Stack>();

            await render(
                <GtkStack ref={stackRef} visibleChildName="settings">
                    <GtkStackPage name="home">
                        <GtkLabel>Welcome Home</GtkLabel>
                    </GtkStackPage>
                    <GtkStackPage name="settings">
                        <GtkLabel>Settings Panel</GtkLabel>
                    </GtkStackPage>
                    <GtkStackPage name="about">
                        <GtkLabel>About This App</GtkLabel>
                    </GtkStackPage>
                </GtkStack>,
            );

            expect(stackRef.current).toHaveObjectProperty("visibleChildName", "settings");
        });
    });
});
