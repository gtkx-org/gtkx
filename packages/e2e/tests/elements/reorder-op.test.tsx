import type * as Adw from "@gtkx/gi/adw";
import type { ReactNode } from "react";
import * as Gtk from "@gtkx/gi/gtk";
import { AdwCarousel, AdwTabPage, AdwTabView } from "@gtkx/jsx/adw";
import { GtkLabel } from "@gtkx/jsx/gtk";
import { getWidgetNodeText, within } from "@gtkx/testing";
import { createRef, type RefObject } from "react";
import { describe, expect, it } from "vitest";
import { buildPlainNotebook } from "../helpers/notebook-render.js";
import { renderChildren } from "../helpers/render-children.js";

type ReorderCase<Container> = {
    build: (ref: RefObject<Container | null>) => (items: string[]) => ReactNode;
    read: (container: Container) => string[];
};

const CAROUSEL_CASE: ReorderCase<Adw.Carousel> = { build: buildCarousel, read: carouselLabels };
const NOTEBOOK_CASE: ReorderCase<Gtk.Notebook> = { build: buildPlainNotebook, read: tabLabels };
const TAB_VIEW_CASE: ReorderCase<Adw.TabView> = { build: buildTabView, read: tabViewTitles };

function carouselLabels(carousel: Adw.Carousel): string[] {
    const labels: string[] = [];

    for (let index = 0; index < carousel.getNPages(); index += 1) {
        const page = carousel.getNthPage(index);

        if (page instanceof Gtk.Label) {
            labels.push(page.getText());
        }
    }

    return labels;
}

function buildCarousel(ref: RefObject<Adw.Carousel | null>) {
    return (items: string[]) => (
        <AdwCarousel ref={ref}>
            {items.map((text) => (
                <GtkLabel key={text}>{text}</GtkLabel>
            ))}
        </AdwCarousel>
    );
}

function tabLabels(notebook: Gtk.Notebook): string[] {
    return within(notebook)
        .getAllByRole(Gtk.AccessibleRole.TAB)
        .map((tab) => getWidgetNodeText(within(tab).getByRole(Gtk.AccessibleRole.LABEL)) ?? "");
}

function tabViewTitles(view: Adw.TabView): string[] {
    const titles: string[] = [];

    for (let index = 0; index < view.getNPages(); index += 1) {
        titles.push(view.getNthPage(index).getTitle());
    }

    return titles;
}

function buildTabView(ref: RefObject<Adw.TabView | null>) {
    return (items: string[]) => (
        <AdwTabView ref={ref}>
            {items.map((title) => (
                <AdwTabPage key={title} title={title}>
                    <GtkLabel>{title}</GtkLabel>
                </AdwTabPage>
            ))}
        </AdwTabView>
    );
}

async function reorderAndRead<Container>(
    { build, read }: ReorderCase<Container>,
    initial: string[],
    next: string[],
): Promise<string[]> {
    const ref = createRef<Container>();
    const { rerender } = await renderChildren(initial, build(ref));
    await rerender(next);

    return read(ref.current as Container);
}

describe("reorder op - containers with native index reorder (1)", () => {
    describe("AdwCarousel", () => {
        it("moves a child to the front", async () => {
            expect(await reorderAndRead(CAROUSEL_CASE, ["A", "B", "C"], ["C", "A", "B"])).toEqual(["C", "A", "B"]);
        });

        it("moves a child to the back", async () => {
            expect(await reorderAndRead(CAROUSEL_CASE, ["A", "B", "C"], ["B", "C", "A"])).toEqual(["B", "C", "A"]);
        });

        it("reverses order", async () => {
            expect(await reorderAndRead(CAROUSEL_CASE, ["A", "B", "C", "D"], ["D", "C", "B", "A"])).toEqual([
                "D",
                "C",
                "B",
                "A",
            ]);
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
});

describe("reorder op - containers with native index reorder (2)", () => {
    describe("GtkNotebook", () => {
        it("moves a page to the front", async () => {
            expect(await reorderAndRead(NOTEBOOK_CASE, ["A", "B", "C"], ["C", "A", "B"])).toEqual(["C", "A", "B"]);
        });

        it("moves a page to the back", async () => {
            expect(await reorderAndRead(NOTEBOOK_CASE, ["A", "B", "C"], ["B", "C", "A"])).toEqual(["B", "C", "A"]);
        });

        it("reverses order", async () => {
            expect(await reorderAndRead(NOTEBOOK_CASE, ["A", "B", "C", "D"], ["D", "C", "B", "A"])).toEqual([
                "D",
                "C",
                "B",
                "A",
            ]);
        });
    });
});

describe("reorder op - containers with native index reorder (3)", () => {
    describe("AdwTabView (page-based reorder via adopted arg)", () => {
        it("moves a page to the front", async () => {
            expect(await reorderAndRead(TAB_VIEW_CASE, ["A", "B", "C"], ["C", "A", "B"])).toEqual(["C", "A", "B"]);
        });

        it("reverses order", async () => {
            expect(await reorderAndRead(TAB_VIEW_CASE, ["A", "B", "C", "D"], ["D", "C", "B", "A"])).toEqual([
                "D",
                "C",
                "B",
                "A",
            ]);
        });

        it("removes a middle page via closePage", async () => {
            expect(await reorderAndRead(TAB_VIEW_CASE, ["A", "B", "C"], ["A", "C"])).toEqual(["A", "C"]);
        });

        it("reorders and removes together", async () => {
            expect(await reorderAndRead(TAB_VIEW_CASE, ["A", "B", "C", "D"], ["D", "A", "C"])).toEqual([
                "D",
                "A",
                "C",
            ]);
        });
    });
});
