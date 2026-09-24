import type { RefObject } from "react";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkButton, GtkLabel, GtkStack, GtkStackPage } from "@gtkx/jsx/gtk";
import { render, screen, userEvent, waitFor } from "@gtkx/testing";
import { renderChildren } from "@gtkx/testing/internal";
import { createRef, useState } from "react";
import { describe, expect, it } from "vitest";
import { buildNamedPages, pageNamed, renderSinglePage } from "../helpers/stack-pages.js";

const buildTitledPages = (stackRef: RefObject<Gtk.Stack | null>) => (pages: { key: string; title: string }[]) => (
    <GtkStack ref={stackRef}>
        {pages.map((page) => (
            <GtkStackPage key={page.key} name={page.key} title={page.title}>
                <GtkLabel>{page.key}</GtkLabel>
            </GtkStackPage>
        ))}
    </GtkStack>
);

const pageNames = (stack: Gtk.Stack | null): (string | null)[] => {
    if (stack === null) {
        throw new Error("expected the stack ref to be assigned");
    }

    const pages = stack.getPages();

    return Array.from({ length: pages.getNItems() }, (_, index) => {
        const page = pages.getItem(index);

        return page instanceof Gtk.StackPage ? page.getName() : null;
    });
};

describe("render - Stack", () => {
    it("creates Stack widget", async () => {
        const ref = createRef<Gtk.Stack>();
        await render(<GtkStack ref={ref} />);
        expect(ref.current).not.toBeNull();
    });

    it("adds named page", async () => {
        const stack = await renderSinglePage({ name: "page1" });
        const content = await screen.findByText("Content");
        expect(stack.getVisibleChild()).toBe(content);
        expect(pageNamed(stack, "page1")?.getName()).toBe("page1");
    });

    it("adds child page (no name/title)", async () => {
        const stack = await renderSinglePage({});
        const content = await screen.findByText("Content");
        expect(stack.getVisibleChild()).toBe(content);
        expect(stack.getPage(content).getName()).toBeNull();
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

    describe("page management", () => {
        it("inserts page before existing page", async () => {
            const stackRef = createRef<Gtk.Stack>();
            const { rerender } = await renderChildren(["first", "last"], buildNamedPages(stackRef));
            const stack = stackRef.current;
            expect(pageNames(stack)).toEqual(["first", "last"]);
            await rerender(["first", "middle", "last"]);
            expect(stackRef.current).toBe(stack);
            expect(pageNames(stack)).toEqual(["first", "middle", "last"]);
        });

        it("removes page", async () => {
            const stackRef = createRef<Gtk.Stack>();
            const { rerender } = await renderChildren(["a", "b", "c"], buildNamedPages(stackRef));
            const stack = stackRef.current;
            expect(pageNames(stack)).toEqual(["a", "b", "c"]);
            await rerender(["a", "c"]);
            expect(stackRef.current).toBe(stack);
            expect(pageNames(stack)).toEqual(["a", "c"]);
            expect(stack?.getChildByName("b")).toBeNull();
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

    describe("page navigation with waitFor", () => {
        it("changes visible page with controlled state", async () => {
            const stackRef = createRef<Gtk.Stack>();

            function NavigableStack() {
                const [page, setPage] = useState("page1");

                return (
                    <GtkBox orientation={Gtk.Orientation.VERTICAL}>
                        <GtkButton
                            label="Show second page"
                            onClicked={() => {
                                setPage("page2");
                            }}
                        />
                        <GtkStack ref={stackRef} visibleChildName={page}>
                            <GtkStackPage name="page1">
                                <GtkLabel>First Page</GtkLabel>
                            </GtkStackPage>
                            <GtkStackPage name="page2">
                                <GtkLabel>Second Page</GtkLabel>
                            </GtkStackPage>
                        </GtkStack>
                    </GtkBox>
                );
            }

            await render(<NavigableStack />);
            const stack = stackRef.current;
            expect(stack).toHaveObjectProperty("visibleChildName", "page1");
            expect(screen.getByText("First Page")).toBeVisible();
            expect(screen.queryByText("Second Page")).toBeNull();
            await userEvent.click(screen.getByRole(Gtk.AccessibleRole.BUTTON, { name: "Show second page" }));
            await waitFor(() => {
                expect(stackRef.current).toBe(stack);
                expect(stack).toHaveObjectProperty("visibleChildName", "page2");
                expect(screen.getByText("Second Page")).toBeVisible();
                expect(screen.queryByText("First Page")).toBeNull();
            });
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
            const content = screen.getByText("Settings Panel");
            expect(content).toBeVisible();
            expect(stackRef.current?.getVisibleChild()).toBe(content);
            expect(screen.queryByText("Welcome Home")).toBeNull();
            expect(screen.queryByText("About This App")).toBeNull();
        });
    });
});

describe("render - StackPage", () => {
    it("adds named page to Stack", async () => {
        const stack = await renderSinglePage({ name: "test-page" });
        expect(stack.getChildByName("test-page")).not.toBeNull();
    });

    it("sets page title", async () => {
        const stack = await renderSinglePage({ name: "titled", title: "Page Title" });
        expect(pageNamed(stack, "titled")).toHaveObjectProperty("title", "Page Title");
    });

    it("sets page icon", async () => {
        const stack = await renderSinglePage({ name: "iconic", iconName: "dialog-information" });
        expect(pageNamed(stack, "iconic")).toHaveObjectProperty("iconName", "dialog-information");
    });

    it("removes page from Stack", async () => {
        const stackRef = createRef<Gtk.Stack>();
        const { rerender } = await renderChildren(["a", "b"], buildNamedPages(stackRef));
        const stack = stackRef.current;
        expect(pageNames(stack)).toEqual(["a", "b"]);
        await rerender(["a"]);
        expect(stackRef.current).toBe(stack);
        expect(pageNames(stack)).toEqual(["a"]);
        expect(stack?.getChildByName("b")).toBeNull();
    });

    it("keeps updated page props after a reorder-triggered rebuild", async () => {
        const stackRef = createRef<Gtk.Stack>();

        const { rerender } = await renderChildren(
            [
                { key: "a", title: "A1" },
                { key: "b", title: "B1" },
            ],
            buildTitledPages(stackRef),
        );

        await rerender([
            { key: "a", title: "A2" },
            { key: "b", title: "B1" },
        ]);

        await rerender([
            { key: "z", title: "Z1" },
            { key: "a", title: "A2" },
            { key: "b", title: "B1" },
        ]);

        expect(pageNamed(stackRef.current, "a")).toHaveObjectProperty("title", "A2");
    });

    it("connects a notify handler on the page object", async () => {
        const seen: unknown[] = [];

        const stack = await renderSinglePage({
            name: "p",
            title: "First",
            onNotifyTitle: (value) => {
                seen.push(value);
            },
        });

        pageNamed(stack, "p")?.setTitle("Second");
        expect(seen).toEqual(["Second"]);
    });
});
