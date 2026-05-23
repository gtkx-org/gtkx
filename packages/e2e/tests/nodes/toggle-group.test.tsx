import type * as Adw from "@gtkx/ffi/adw";
import * as Gtk from "@gtkx/ffi/gtk";
import { AdwToggleGroup } from "@gtkx/react";
import { render, screen, userEvent, waitFor } from "@gtkx/testing";
import { createRef, type RefObject } from "react";
import { describe, expect, it } from "vitest";
import { renderChildren } from "../helpers/render-children.js";

type Toggle = { id: string; label: string };

const buildToggleGroup = (ref: RefObject<Adw.ToggleGroup | null>) => (toggles: Toggle[]) => (
    <AdwToggleGroup ref={ref} toggles={toggles} />
);

describe("render - ToggleGroup (1)", () => {
    describe("ToggleGroupNode (1)", () => {
        it("creates ToggleGroup widget without toggles", async () => {
            const ref = createRef<Adw.ToggleGroup>();

            await render(<AdwToggleGroup ref={ref} />);

            expect(ref.current).not.toBeNull();
            expect(ref.current?.getNToggles()).toBe(0);
        });

        it("creates ToggleGroup widget with toggles", async () => {
            await render(
                <AdwToggleGroup
                    toggles={[
                        { id: "list", label: "List View", iconName: "view-list-symbolic" },
                        { id: "grid", label: "Grid View", iconName: "view-grid-symbolic" },
                    ]}
                />,
            );

            const toggles = await screen.findAllByRole(Gtk.AccessibleRole.RADIO);
            expect(toggles).toHaveLength(2);
        });

        it("sets toggle label", async () => {
            await render(<AdwToggleGroup toggles={[{ id: "test", label: "Test Label" }]} />);

            const toggle = await screen.findByRole(Gtk.AccessibleRole.RADIO, { name: "Test Label" });
            expect(toggle).toBeDefined();
        });

        it("sets toggle enabled state", async () => {
            const ref = createRef<Adw.ToggleGroup>();

            await render(
                <AdwToggleGroup
                    ref={ref}
                    toggles={[
                        { id: "enabled", label: "Enabled" },
                        { id: "disabled", label: "Disabled", enabled: false },
                    ]}
                />,
            );

            expect(ref.current?.getToggleByName("enabled")?.getEnabled()).toBe(true);
            expect(ref.current?.getToggleByName("disabled")?.getEnabled()).toBe(false);
        });
    });
});

describe("render - ToggleGroup (2)", () => {
    describe("ToggleGroupNode (2)", () => {
        it("updates toggle props", async () => {
            const ref = createRef<Adw.ToggleGroup>();

            const { rerender } = await renderChildren([{ id: "test", label: "Initial" }], buildToggleGroup(ref));
            expect(ref.current?.getToggleByName("test")?.getLabel()).toBe("Initial");

            await rerender([{ id: "test", label: "Updated" }]);
            expect(ref.current?.getToggleByName("test")?.getLabel()).toBe("Updated");
        });

        it("removes toggles when list shrinks", async () => {
            const ref = createRef<Adw.ToggleGroup>();

            const { rerender } = await renderChildren(
                [
                    { id: "always", label: "Always" },
                    { id: "extra", label: "Extra" },
                ],
                buildToggleGroup(ref),
            );
            expect(ref.current?.getNToggles()).toBe(2);
            expect(ref.current?.getToggleByName("always")).not.toBeNull();
            expect(ref.current?.getToggleByName("extra")).not.toBeNull();

            await rerender([{ id: "always", label: "Always" }]);
            expect(ref.current?.getNToggles()).toBe(1);
            expect(ref.current?.getToggleByName("always")).not.toBeNull();
            expect(ref.current?.getToggleByName("extra")).toBeNull();
        });
    });
});

describe("render - ToggleGroup (3)", () => {
    describe("ToggleGroupNode (3)", () => {
        it("handles inserting toggles dynamically", async () => {
            const ref = createRef<Adw.ToggleGroup>();

            const { rerender } = await renderChildren(
                [
                    { id: "first", label: "First" },
                    { id: "last", label: "Last" },
                ],
                buildToggleGroup(ref),
            );
            expect(ref.current?.getNToggles()).toBe(2);

            await rerender([
                { id: "first", label: "First" },
                { id: "middle", label: "Middle" },
                { id: "last", label: "Last" },
            ]);
            expect(ref.current?.getNToggles()).toBe(3);
            expect(ref.current?.getToggleByName("middle")).not.toBeNull();
        });
    });
});

describe("render - ToggleGroup (4)", () => {
    describe("user interactions (1)", () => {
        it("clicks toggle to activate it", async () => {
            const ref = createRef<Adw.ToggleGroup>();

            await render(
                <AdwToggleGroup
                    ref={ref}
                    toggles={[
                        { id: "list", label: "List" },
                        { id: "grid", label: "Grid" },
                    ]}
                />,
            );

            const listToggle = await screen.findByRole(Gtk.AccessibleRole.RADIO, { name: "List" });
            await userEvent.click(listToggle);

            await waitFor(() => {
                expect(ref.current?.getActive()).toBe(0);
            });
        });

        it("switches between toggles", async () => {
            const ref = createRef<Adw.ToggleGroup>();

            await render(
                <AdwToggleGroup
                    ref={ref}
                    toggles={[
                        { id: "list", label: "List" },
                        { id: "grid", label: "Grid" },
                    ]}
                />,
            );

            const gridToggle = await screen.findByRole(Gtk.AccessibleRole.RADIO, { name: "Grid" });

            await userEvent.click(gridToggle);

            await waitFor(() => {
                expect(ref.current?.getActive()).toBe(1);
            });
        });
    });
});

describe("render - ToggleGroup (5)", () => {
    describe("user interactions (2)", () => {
        it("finds all toggles by role in a toggle group", async () => {
            await render(
                <AdwToggleGroup
                    toggles={[
                        { id: "list", label: "List View" },
                        { id: "grid", label: "Grid View" },
                        { id: "tiles", label: "Tiles View" },
                    ]}
                />,
            );

            const toggles = await screen.findAllByRole(Gtk.AccessibleRole.RADIO);
            expect(toggles).toHaveLength(3);

            const listToggle = await screen.findByRole(Gtk.AccessibleRole.RADIO, { name: "List View" });
            expect(listToggle).toBeDefined();
        });
    });
});
