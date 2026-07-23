import type * as Gtk from "@gtkx/gi/gtk";
import { GtkLabel, GtkStack, GtkStackPage } from "@gtkx/jsx/gtk";
import { render } from "@gtkx/testing";
import { createRef } from "react";
import { describe, expect, it } from "vitest";
import { renderChildren } from "../helpers/render-children.js";

describe("render - StackPage", () => {
    it("adds named page to Stack", async () => {
        const stackRef = createRef<Gtk.Stack>();

        await render(
            <GtkStack ref={stackRef}>
                <GtkStackPage name="test-page">
                    <GtkLabel>Content</GtkLabel>
                </GtkStackPage>
            </GtkStack>,
        );

        expect(stackRef.current?.getChildByName("test-page")).not.toBeNull();
    });

    it("sets page title", async () => {
        const stackRef = createRef<Gtk.Stack>();

        await render(
            <GtkStack ref={stackRef}>
                <GtkStackPage name="titled" title="Page Title">
                    <GtkLabel>Content</GtkLabel>
                </GtkStackPage>
            </GtkStack>,
        );

        const child = stackRef.current?.getChildByName("titled");
        const page = stackRef.current?.getPage(child as Gtk.Widget);
        expect(page?.getTitle()).toBe("Page Title");
    });

    it("sets page icon", async () => {
        const stackRef = createRef<Gtk.Stack>();

        await render(
            <GtkStack ref={stackRef}>
                <GtkStackPage name="iconic" iconName="dialog-information">
                    <GtkLabel>Content</GtkLabel>
                </GtkStackPage>
            </GtkStack>,
        );

        const child = stackRef.current?.getChildByName("iconic");
        const page = stackRef.current?.getPage(child as Gtk.Widget);
        expect(page?.getIconName()).toBe("dialog-information");
    });

    it("removes page from Stack", async () => {
        const stackRef = createRef<Gtk.Stack>();
        const buildStack = (pages: string[]) => (
            <GtkStack ref={stackRef}>
                {pages.map((name) => (
                    <GtkStackPage key={name} name={name}>
                        <GtkLabel>{name}</GtkLabel>
                    </GtkStackPage>
                ))}
            </GtkStack>
        );

        const { rerender } = await renderChildren(["a", "b"], buildStack);
        expect(stackRef.current?.getChildByName("b")).not.toBeNull();

        await rerender(["a"]);
        expect(stackRef.current?.getChildByName("b")).toBeNull();
    });
});
