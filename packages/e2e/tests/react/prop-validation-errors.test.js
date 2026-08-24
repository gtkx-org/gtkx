import {
    AdwMultiLayoutView,
    AdwNavigationPage,
    AdwNavigationSplitView,
    AdwToggle,
    AdwToggleGroup,
} from "@gtkx/jsx/adw";
import { GMenu } from "@gtkx/jsx/gio";
import { GtkButton, GtkEntry, GtkLabel, GtkListBox, GtkStack, GtkStackPage } from "@gtkx/jsx/gtk";
import { render } from "@gtkx/testing";
import { createElement } from "react";
import { describe, expect, it } from "vitest";

describe("synthetic prop validation errors", () => {
    it("throws when a list prop is present but is not an array", async () => {
        await expect(render(createElement(GMenu, { items: "not-an-array" }))).rejects.toThrow();
    });

    it("throws when selectedIndex is present but is not a number", async () => {
        await expect(render(createElement(GtkListBox, { selectedIndex: "first" }))).rejects.toThrow();
    });

    it("throws when an active style receives non-array cssClasses", async () => {
        await expect(
            render(createElement(GtkLabel, { cssClasses: "heading", style: { fontWeight: "bold" } })),
        ).rejects.toThrow();
    });

    it("throws when a signal handler prop is present but is not a function", async () => {
        await expect(render(createElement(GtkButton, { onClicked: "click" }))).rejects.toThrow();
    });

    it("throws when an updated signal handler prop is not a function", async () => {
        const { rerender } = await render(createElement(GtkEntry, { text: "before" }));
        await expect(rerender(createElement(GtkEntry, { onChanged: "change", text: "after" }))).rejects.toThrow();
    });

    it("throws when style is present but is not an object", async () => {
        await expect(render(createElement(GtkLabel, { style: "bold" }))).rejects.toThrow();
    });

    it("throws when an accessible relation becomes malformed", async () => {
        const { rerender } = await render(createElement(GtkLabel, { accessibleLabel: "ok" }, "label"));
        await expect(rerender(createElement(GtkLabel, { accessibleControls: "bad" }, "label"))).rejects.toThrow();
    });
});

describe("synthetic deferred prop validation errors", () => {
    it("throws when a stack page name becomes malformed", async () => {
        const page = createElement(GtkStackPage, { name: "first", title: "First" }, createElement(GtkLabel));
        const { rerender } = await render(createElement(GtkStack, { visibleChildName: "first" }, page));
        await expect(rerender(createElement(GtkStack, { visibleChildName: 7 }, page))).rejects.toThrow();
    });

    it("throws when a layout name becomes malformed", async () => {
        const { rerender } = await render(createElement(AdwMultiLayoutView));
        await expect(rerender(createElement(AdwMultiLayoutView, { layoutName: 7 }))).rejects.toThrow();
    });

    it("throws when a toggle name becomes malformed", async () => {
        const { rerender } = await render(createElement(AdwToggleGroup));
        await expect(rerender(createElement(AdwToggleGroup, { activeName: 7 }))).rejects.toThrow();
    });

    it("throws when a toggle index becomes malformed", async () => {
        const { rerender } = await render(createElement(AdwToggleGroup));
        await expect(rerender(createElement(AdwToggleGroup, { active: "bad" }))).rejects.toThrow();
    });

    it("throws when toggle name and index both control selection", async () => {
        const toggles = [
            createElement(AdwToggle, { key: "one", name: "one", label: "One" }),
            createElement(AdwToggle, { key: "two", name: "two", label: "Two" }),
        ];

        await expect(
            render(createElement(AdwToggleGroup, { activeName: "one", active: 1 }, toggles)),
        ).rejects.toThrow();
    });

    it("throws when split-view visibility becomes malformed", async () => {
        const sidebar = createElement(AdwNavigationPage, { title: "Side" }, createElement(GtkLabel));
        const content = createElement(AdwNavigationPage, { title: "Content" }, createElement(GtkLabel));

        const { rerender } = await render(
            createElement(AdwNavigationSplitView, { showContent: true, sidebar }, content),
        );

        await expect(
            rerender(createElement(AdwNavigationSplitView, { showContent: "bad", sidebar }, content)),
        ).rejects.toThrow();
    });
});
