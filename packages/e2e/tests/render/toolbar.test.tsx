import type * as Adw from "@gtkx/ffi/adw";
import type * as Gtk from "@gtkx/ffi/gtk";
import { AdwHeaderBar, AdwToolbarView, GtkLabel, Toolbar } from "@gtkx/react";
import { render } from "@gtkx/testing";
import { createRef } from "react";
import { describe, expect, it } from "vitest";

describe("render - Toolbar", () => {
    describe("ToolbarNode (AdwToolbarView)", () => {
        it("creates ToolbarView widget", async () => {
            const ref = createRef<Adw.ToolbarView>();

            await render(<AdwToolbarView ref={ref} />, { wrapper: false });

            expect(ref.current).not.toBeNull();
        });

        it("sets content", async () => {
            const toolbarRef = createRef<Adw.ToolbarView>();
            const contentRef = createRef<Gtk.Label>();

            await render(
                <AdwToolbarView ref={toolbarRef}>
                    <GtkLabel ref={contentRef} label="Main Content" />
                </AdwToolbarView>,
                { wrapper: false },
            );

            expect(toolbarRef.current?.getContent()?.equals(contentRef.current)).toBe(true);
        });

        it("adds top toolbar", async () => {
            const toolbarRef = createRef<Adw.ToolbarView>();

            const { findByText } = await render(
                <AdwToolbarView ref={toolbarRef}>
                    <Toolbar.Top>
                        <AdwHeaderBar />
                    </Toolbar.Top>
                    <GtkLabel label="Content" />
                </AdwToolbarView>,
            );

            await findByText("Content");
            expect(toolbarRef.current?.getContent()).not.toBeNull();
        });

        it("adds bottom toolbar", async () => {
            const toolbarRef = createRef<Adw.ToolbarView>();

            const { findByText } = await render(
                <AdwToolbarView ref={toolbarRef}>
                    <GtkLabel label="Content" />
                    <Toolbar.Bottom>
                        <AdwHeaderBar />
                    </Toolbar.Bottom>
                </AdwToolbarView>,
            );

            await findByText("Content");
            expect(toolbarRef.current?.getContent()).not.toBeNull();
        });

        it("adds both top and bottom toolbars", async () => {
            const toolbarRef = createRef<Adw.ToolbarView>();

            const { findByText } = await render(
                <AdwToolbarView ref={toolbarRef}>
                    <Toolbar.Top>
                        <AdwHeaderBar />
                    </Toolbar.Top>
                    <GtkLabel label="Content" />
                    <Toolbar.Bottom>
                        <AdwHeaderBar />
                    </Toolbar.Bottom>
                </AdwToolbarView>,
            );

            await findByText("Content");
            expect(toolbarRef.current?.getContent()).not.toBeNull();
        });
    });
});
