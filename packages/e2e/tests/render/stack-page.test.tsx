import type * as Gtk from "@gtkx/ffi/gtk";
import { GtkStack, StackPage } from "@gtkx/react";
import { render } from "@gtkx/testing";
import { createRef } from "react";
import { describe, expect, it } from "vitest";

describe("render - StackPage", () => {
    describe("StackPageNode", () => {
        it("adds named page to Stack", async () => {
            const stackRef = createRef<Gtk.Stack>();

            await render(
                <GtkStack ref={stackRef}>
                    <StackPage name="test-page">Content</StackPage>
                </GtkStack>,
                { wrapper: false },
            );

            expect(stackRef.current?.getChildByName("test-page")).not.toBeNull();
        });

        it("sets page title", async () => {
            const stackRef = createRef<Gtk.Stack>();

            await render(
                <GtkStack ref={stackRef}>
                    <StackPage name="titled" title="Page Title">
                        Content
                    </StackPage>
                </GtkStack>,
                { wrapper: false },
            );

            const child = stackRef.current?.getChildByName("titled");
            const page = stackRef.current?.getPage(child as Gtk.Widget);
            expect(page?.getTitle()).toBe("Page Title");
        });

        it("sets page icon", async () => {
            const stackRef = createRef<Gtk.Stack>();

            await render(
                <GtkStack ref={stackRef}>
                    <StackPage name="iconic" iconName="dialog-information">
                        Content
                    </StackPage>
                </GtkStack>,
                { wrapper: false },
            );

            const child = stackRef.current?.getChildByName("iconic");
            const page = stackRef.current?.getPage(child as Gtk.Widget);
            expect(page?.getIconName()).toBe("dialog-information");
        });

        it("removes page from Stack", async () => {
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

            await render(<App pages={["a", "b"]} />, { wrapper: false });
            expect(stackRef.current?.getChildByName("b")).not.toBeNull();

            await render(<App pages={["a"]} />, { wrapper: false });
            expect(stackRef.current?.getChildByName("b")).toBeNull();
        });
    });
});
