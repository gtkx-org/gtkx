import type * as Gtk from "@gtkx/ffi/gtk";
import { GtkStack } from "@gtkx/react";
import { render } from "@gtkx/testing";
import { createRef } from "react";
import { describe, expect, it } from "vitest";
import { renderChildren } from "../helpers/render-children.js";

describe("render - StackPage", () => {
    describe("StackPageNode", () => {
        it("adds named page to Stack", async () => {
            const stackRef = createRef<Gtk.Stack>();

            await render(
                <GtkStack ref={stackRef}>
                    <GtkStack.Page id="test-page">Content</GtkStack.Page>
                </GtkStack>,
            );

            expect(stackRef.current?.getChildByName("test-page")).not.toBeNull();
        });

        it("sets page title", async () => {
            const stackRef = createRef<Gtk.Stack>();

            await render(
                <GtkStack ref={stackRef}>
                    <GtkStack.Page id="titled" title="Page Title">
                        Content
                    </GtkStack.Page>
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
                    <GtkStack.Page id="iconic" iconName="dialog-information">
                        Content
                    </GtkStack.Page>
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
                        <GtkStack.Page key={name} id={name}>
                            {name}
                        </GtkStack.Page>
                    ))}
                </GtkStack>
            );

            const { rerender } = await renderChildren(["a", "b"], buildStack);
            expect(stackRef.current?.getChildByName("b")).not.toBeNull();

            await rerender(["a"]);
            expect(stackRef.current?.getChildByName("b")).toBeNull();
        });
    });
});
