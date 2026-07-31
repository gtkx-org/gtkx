import type * as Gtk from "@gtkx/gi/gtk";
import type { ComponentProps, RefObject } from "react";
import { GtkLabel, GtkStack, GtkStackPage } from "@gtkx/jsx/gtk";
import { render } from "@gtkx/testing";
import { createRef } from "react";
import { describe, expect, it } from "vitest";
import { renderChildren } from "../helpers/render-children.js";

type StackPageProps = ComponentProps<typeof GtkStackPage>;

const renderSinglePage = async (props: StackPageProps): Promise<Gtk.Stack> => {
    const stackRef = createRef<Gtk.Stack>();

    await render(
        <GtkStack ref={stackRef}>
            <GtkStackPage {...props}>
                <GtkLabel>Content</GtkLabel>
            </GtkStackPage>
        </GtkStack>,
    );

    return stackRef.current as Gtk.Stack;
};

const pageNamed = (stack: Gtk.Stack | null, name: string): Gtk.StackPage | undefined =>
    stack?.getPage(stack.getChildByName(name) as Gtk.Widget);

const buildNamedPages = (stackRef: RefObject<Gtk.Stack | null>) => (pages: string[]) => (
    <GtkStack ref={stackRef}>
        {pages.map((name) => (
            <GtkStackPage key={name} name={name}>
                <GtkLabel>{name}</GtkLabel>
            </GtkStackPage>
        ))}
    </GtkStack>
);

const buildTitledPages = (stackRef: RefObject<Gtk.Stack | null>) => (pages: { key: string; title: string }[]) => (
    <GtkStack ref={stackRef}>
        {pages.map((page) => (
            <GtkStackPage key={page.key} name={page.key} title={page.title}>
                <GtkLabel>{page.key}</GtkLabel>
            </GtkStackPage>
        ))}
    </GtkStack>
);

describe("render - StackPage (1)", () => {
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
        expect(stackRef.current?.getChildByName("b")).not.toBeNull();
        await rerender(["a"]);
        expect(stackRef.current?.getChildByName("b")).toBeNull();
    });
});

describe("render - StackPage (2)", () => {
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
