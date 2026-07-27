import type * as Adw from "@gtkx/gi/adw";
import * as Gtk from "@gtkx/gi/gtk";
import { AdwToggle, AdwToggleGroup } from "@gtkx/jsx/adw";
import { render, screen, userEvent, waitFor } from "@gtkx/testing";
import { createRef, type RefObject } from "react";
import { describe, expect, it } from "vitest";
import { renderChildren } from "../helpers/render-children.js";

type Toggle = { id: string; label: string; enabled?: boolean };

const LIST_GRID_TOGGLES = (
    <>
        <AdwToggle name="list" label="List" />
        <AdwToggle name="grid" label="Grid" />
    </>
);

const LIST_GRID_VIEW_GROUP = (
    <AdwToggleGroup>
        <AdwToggle name="list" label="List View" iconName="view-list-symbolic" />
        <AdwToggle name="grid" label="Grid View" iconName="view-grid-symbolic" />
    </AdwToggleGroup>
);

const THREE_VIEW_GROUP = (
    <AdwToggleGroup>
        <AdwToggle name="list" label="List View" />
        <AdwToggle name="grid" label="Grid View" />
        <AdwToggle name="tiles" label="Tiles View" />
    </AdwToggleGroup>
);

const buildToggleGroup = (ref: RefObject<Adw.ToggleGroup | null>) => (toggles: Toggle[]) => (
    <AdwToggleGroup ref={ref}>
        {toggles.map((toggle) => (
            <AdwToggle key={toggle.id} name={toggle.id} label={toggle.label} enabled={toggle.enabled ?? true} />
        ))}
    </AdwToggleGroup>
);

const renderEnabledStateGroup = (ref: RefObject<Adw.ToggleGroup | null>) =>
    render(
        <AdwToggleGroup ref={ref}>
            <AdwToggle name="enabled" label="Enabled" />
            <AdwToggle name="disabled" label="Disabled" enabled={false} />
        </AdwToggleGroup>,
    );

const renderActiveNameGroup = (ref: RefObject<Adw.ToggleGroup | null>) =>
    render(
        <AdwToggleGroup ref={ref} activeName="done">
            <AdwToggle name="all" label="All" />
            <AdwToggle name="open" label="Open" />
            <AdwToggle name="done" label="Done" />
        </AdwToggleGroup>,
    );

const expectToggleActiveAfterClick = async (name: string): Promise<void> => {
    const toggle = await screen.findByRole(Gtk.AccessibleRole.RADIO, { name });
    await userEvent.click(toggle);
    expect(await screen.findByRole(Gtk.AccessibleRole.RADIO, { name, pressed: true })).toBeDefined();
};

describe("render - ToggleGroup (1)", () => {
    describe("AdwToggleGroup (1)", () => {
        it("creates ToggleGroup widget without toggles", async () => {
            const ref = createRef<Adw.ToggleGroup>();
            await render(<AdwToggleGroup ref={ref} />);
            expect(ref.current).not.toBeNull();
            expect(screen.queryAllByRole(Gtk.AccessibleRole.RADIO)).toHaveLength(0);
        });

        it("creates ToggleGroup widget with toggles", async () => {
            await render(LIST_GRID_VIEW_GROUP);
            const toggles = await screen.findAllByRole(Gtk.AccessibleRole.RADIO);
            expect(toggles).toHaveLength(2);
        });

        it("sets toggle label", async () => {
            await render(
                <AdwToggleGroup>
                    <AdwToggle name="test" label="Test Label" />
                </AdwToggleGroup>,
            );

            const toggle = await screen.findByRole(Gtk.AccessibleRole.RADIO, { name: "Test Label" });
            expect(toggle).toBeDefined();
        });

        it("sets toggle enabled state", async () => {
            const ref = createRef<Adw.ToggleGroup>();
            await renderEnabledStateGroup(ref);
            expect(ref.current?.getToggleByName("enabled")?.getEnabled()).toBe(true);
            expect(ref.current?.getToggleByName("disabled")?.getEnabled()).toBe(false);
        });

        it("selects the toggle named by activeName once its toggle exists", async () => {
            const ref = createRef<Adw.ToggleGroup>();
            await renderActiveNameGroup(ref);
            expect(ref.current?.getActiveName()).toBe("done");
        });
    });
});

describe("render - ToggleGroup (2)", () => {
    describe("AdwToggleGroup (2)", () => {
        it("updates toggle props", async () => {
            const ref = createRef<Adw.ToggleGroup>();
            const { rerender } = await renderChildren([{ id: "test", label: "Initial" }], buildToggleGroup(ref));
            expect(await screen.findByRole(Gtk.AccessibleRole.RADIO, { name: "Initial" })).toBeDefined();
            await rerender([{ id: "test", label: "Updated" }]);
            expect(await screen.findByRole(Gtk.AccessibleRole.RADIO, { name: "Updated" })).toBeDefined();
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

            expect(await screen.findAllByRole(Gtk.AccessibleRole.RADIO)).toHaveLength(2);
            expect(screen.getByRole(Gtk.AccessibleRole.RADIO, { name: "Always" })).toBeDefined();
            expect(screen.getByRole(Gtk.AccessibleRole.RADIO, { name: "Extra" })).toBeDefined();
            await rerender([{ id: "always", label: "Always" }]);

            await waitFor(() => {
                expect(screen.queryAllByRole(Gtk.AccessibleRole.RADIO)).toHaveLength(1);
            });

            expect(screen.getByRole(Gtk.AccessibleRole.RADIO, { name: "Always" })).toBeDefined();
            expect(screen.queryByRole(Gtk.AccessibleRole.RADIO, { name: "Extra" })).toBeNull();
        });
    });
});

describe("render - ToggleGroup (3)", () => {
    describe("AdwToggleGroup (3)", () => {
        it("handles inserting toggles dynamically", async () => {
            const ref = createRef<Adw.ToggleGroup>();

            const { rerender } = await renderChildren(
                [
                    { id: "first", label: "First" },
                    { id: "last", label: "Last" },
                ],
                buildToggleGroup(ref),
            );

            expect(await screen.findAllByRole(Gtk.AccessibleRole.RADIO)).toHaveLength(2);

            await rerender([
                { id: "first", label: "First" },
                { id: "middle", label: "Middle" },
                { id: "last", label: "Last" },
            ]);

            await waitFor(() => {
                expect(screen.queryAllByRole(Gtk.AccessibleRole.RADIO)).toHaveLength(3);
            });

            expect(screen.getByRole(Gtk.AccessibleRole.RADIO, { name: "Middle" })).toBeDefined();
        });
    });
});

describe("render - ToggleGroup (4)", () => {
    describe("user interactions (1)", () => {
        it("clicks toggle to activate it", async () => {
            await render(<AdwToggleGroup>{LIST_GRID_TOGGLES}</AdwToggleGroup>);
            await expectToggleActiveAfterClick("List");
        });

        it("switches between toggles", async () => {
            await render(<AdwToggleGroup>{LIST_GRID_TOGGLES}</AdwToggleGroup>);
            await expectToggleActiveAfterClick("Grid");
        });
    });
});

describe("render - ToggleGroup (6)", () => {
    describe("uncontrolled selection", () => {
        it("preserves the clicked selection across an unrelated re-render", async () => {
            const { rerender } = await render(<AdwToggleGroup>{LIST_GRID_TOGGLES}</AdwToggleGroup>);
            await expectToggleActiveAfterClick("Grid");
            await rerender(<AdwToggleGroup cssClasses={["flat"]}>{LIST_GRID_TOGGLES}</AdwToggleGroup>);
            expect(await screen.findByRole(Gtk.AccessibleRole.RADIO, { name: "Grid", pressed: true })).toBeDefined();
        });
    });
});

describe("render - ToggleGroup (5)", () => {
    describe("user interactions (2)", () => {
        it("finds all toggles by role in a toggle group", async () => {
            await render(THREE_VIEW_GROUP);
            const toggles = await screen.findAllByRole(Gtk.AccessibleRole.RADIO);
            expect(toggles).toHaveLength(3);
            const listToggle = await screen.findByRole(Gtk.AccessibleRole.RADIO, { name: "List View" });
            expect(listToggle).toBeDefined();
        });
    });
});
