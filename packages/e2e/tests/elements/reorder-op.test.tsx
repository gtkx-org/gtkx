import type * as Adw from "@gtkx/gi/adw";
import * as Gtk from "@gtkx/gi/gtk";
import { AdwCarousel, AdwTabPage, AdwTabView } from "@gtkx/jsx/adw";
import { GtkLabel } from "@gtkx/jsx/gtk";
import { getWidgetNodeText, within } from "@gtkx/testing";
import { createRef, type RefObject } from "react";
import { describe, expect, it } from "vitest";
import { buildPlainNotebook } from "../helpers/notebook-render.js";
import { renderChildren } from "../helpers/render-children.js";

const carouselLabels = (carousel: Adw.Carousel): string[] => {
    const labels: string[] = [];
    for (let index = 0; index < carousel.getNPages(); index += 1) {
        const page = carousel.getNthPage(index);
        if (page instanceof Gtk.Label) labels.push(page.getText());
    }
    return labels;
};

const buildCarousel = (ref: RefObject<Adw.Carousel | null>) => (items: string[]) => (
    <AdwCarousel ref={ref}>
        {items.map((text) => (
            <GtkLabel key={text}>{text}</GtkLabel>
        ))}
    </AdwCarousel>
);

const tabLabels = (notebook: Gtk.Notebook): string[] =>
    within(notebook)
        .getAllByRole(Gtk.AccessibleRole.TAB)
        .map((tab) => getWidgetNodeText(within(tab).getByRole(Gtk.AccessibleRole.LABEL)) ?? "");

const tabViewTitles = (view: Adw.TabView): string[] => {
    const titles: string[] = [];
    for (let index = 0; index < view.getNPages(); index += 1) {
        titles.push(view.getNthPage(index).getTitle());
    }
    return titles;
};

const buildTabView = (ref: RefObject<Adw.TabView | null>) => (items: string[]) => (
    <AdwTabView ref={ref}>
        {items.map((title) => (
            <AdwTabPage key={title} title={title}>
                <GtkLabel>{title}</GtkLabel>
            </AdwTabPage>
        ))}
    </AdwTabView>
);

describe("reorder op - containers with native index reorder", () => {
    describe("AdwCarousel", () => {
        it("moves a child to the front", async () => {
            const ref = createRef<Adw.Carousel>();
            const { rerender } = await renderChildren(["A", "B", "C"], buildCarousel(ref));
            await rerender(["C", "A", "B"]);
            expect(carouselLabels(ref.current as Adw.Carousel)).toEqual(["C", "A", "B"]);
        });

        it("moves a child to the back", async () => {
            const ref = createRef<Adw.Carousel>();
            const { rerender } = await renderChildren(["A", "B", "C"], buildCarousel(ref));
            await rerender(["B", "C", "A"]);
            expect(carouselLabels(ref.current as Adw.Carousel)).toEqual(["B", "C", "A"]);
        });

        it("reverses order", async () => {
            const ref = createRef<Adw.Carousel>();
            const { rerender } = await renderChildren(["A", "B", "C", "D"], buildCarousel(ref));
            await rerender(["D", "C", "B", "A"]);
            expect(carouselLabels(ref.current as Adw.Carousel)).toEqual(["D", "C", "B", "A"]);
        });

        it("preserves the child instance across a reorder", async () => {
            const ref = createRef<Adw.Carousel>();
            const { rerender } = await renderChildren(["A", "B", "C"], buildCarousel(ref));
            const carousel = ref.current as Adw.Carousel;
            const before = carousel.getNthPage(0);
            await rerender(["B", "C", "A"]);
            const moved = carouselLabels(carousel).indexOf("A");
            expect(carousel.getNthPage(moved)).toBe(before);
        });
    });

    describe("GtkNotebook", () => {
        it("moves a page to the front", async () => {
            const ref = createRef<Gtk.Notebook>();
            const { rerender } = await renderChildren(["A", "B", "C"], buildPlainNotebook(ref));
            await rerender(["C", "A", "B"]);
            expect(tabLabels(ref.current as Gtk.Notebook)).toEqual(["C", "A", "B"]);
        });

        it("moves a page to the back", async () => {
            const ref = createRef<Gtk.Notebook>();
            const { rerender } = await renderChildren(["A", "B", "C"], buildPlainNotebook(ref));
            await rerender(["B", "C", "A"]);
            expect(tabLabels(ref.current as Gtk.Notebook)).toEqual(["B", "C", "A"]);
        });

        it("reverses order", async () => {
            const ref = createRef<Gtk.Notebook>();
            const { rerender } = await renderChildren(["A", "B", "C", "D"], buildPlainNotebook(ref));
            await rerender(["D", "C", "B", "A"]);
            expect(tabLabels(ref.current as Gtk.Notebook)).toEqual(["D", "C", "B", "A"]);
        });
    });

    describe("AdwTabView (page-based reorder via adopted arg)", () => {
        it("moves a page to the front", async () => {
            const ref = createRef<Adw.TabView>();
            const { rerender } = await renderChildren(["A", "B", "C"], buildTabView(ref));
            await rerender(["C", "A", "B"]);
            expect(tabViewTitles(ref.current as Adw.TabView)).toEqual(["C", "A", "B"]);
        });

        it("reverses order", async () => {
            const ref = createRef<Adw.TabView>();
            const { rerender } = await renderChildren(["A", "B", "C", "D"], buildTabView(ref));
            await rerender(["D", "C", "B", "A"]);
            expect(tabViewTitles(ref.current as Adw.TabView)).toEqual(["D", "C", "B", "A"]);
        });

        it("removes a middle page via closePage", async () => {
            const ref = createRef<Adw.TabView>();
            const { rerender } = await renderChildren(["A", "B", "C"], buildTabView(ref));
            await rerender(["A", "C"]);
            expect(tabViewTitles(ref.current as Adw.TabView)).toEqual(["A", "C"]);
        });

        it("reorders and removes together", async () => {
            const ref = createRef<Adw.TabView>();
            const { rerender } = await renderChildren(["A", "B", "C", "D"], buildTabView(ref));
            await rerender(["D", "A", "C"]);
            expect(tabViewTitles(ref.current as Adw.TabView)).toEqual(["D", "A", "C"]);
        });
    });
});
