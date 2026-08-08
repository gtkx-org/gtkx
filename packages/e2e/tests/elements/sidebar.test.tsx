import type * as Adw from "@gtkx/gi/adw";
import { AdwSidebar, AdwSidebarItem, AdwSidebarSection } from "@gtkx/jsx/adw";
import { render } from "@gtkx/testing";
import { renderChildren } from "@gtkx/testing/internal";
import { createRef, type ReactNode, type RefObject } from "react";
import { describe, expect, it } from "vitest";

const getItemTitles = (sidebar: Adw.Sidebar | null): string[] => {
    const titles: string[] = [];

    for (let index = 0; ; index += 1) {
        const item = sidebar?.getItem(index) ?? null;

        if (item === null) {
            return titles;
        }

        titles.push(item.getTitle() ?? "");
    }
};

const buildSidebar = (ref: RefObject<Adw.Sidebar | null>) => (titles: string[]) => (
    <AdwSidebar ref={ref}>
        <AdwSidebarSection title="Places">
            {titles.map((title) => (
                <AdwSidebarItem key={title} title={title} />
            ))}
        </AdwSidebarSection>
    </AdwSidebar>
);

const renderSidebar = async (children: ReactNode): Promise<Adw.Sidebar> => {
    const ref = createRef<Adw.Sidebar>();
    await render(<AdwSidebar ref={ref}>{children}</AdwSidebar>);
    const { current } = ref;

    if (!current) {
        throw new TypeError("Expected a Sidebar instance");
    }

    return current;
};

describe("render - AdwSidebar", () => {
    it("adds sections declared as children", async () => {
        const sidebar = await renderSidebar(
            <>
                <AdwSidebarSection title="Places" />
                <AdwSidebarSection title="Tags" />
            </>,
        );

        expect(sidebar.getSections().getNItems()).toBe(2);
        expect(sidebar.getSection(0)?.getTitle()).toBe("Places");
        expect(sidebar.getSection(1)?.getTitle()).toBe("Tags");
    });

    it("adds items declared as children of a section", async () => {
        const sidebar = await renderSidebar(
            <AdwSidebarSection title="Places">
                <AdwSidebarItem title="Home" />
                <AdwSidebarItem title="Documents" />
            </AdwSidebarSection>,
        );

        expect(getItemTitles(sidebar)).toEqual(["Home", "Documents"]);
        expect(sidebar.getSection(0)?.getItem(0)?.getTitle()).toBe("Home");
    });

    it("removes items when the list shrinks", async () => {
        const ref = createRef<Adw.Sidebar>();
        const { rerender } = await renderChildren(["Home", "Documents"], buildSidebar(ref));
        expect(getItemTitles(ref.current)).toEqual(["Home", "Documents"]);
        await rerender(["Home"]);
        expect(getItemTitles(ref.current)).toEqual(["Home"]);
    });

    it("inserts an item in the middle", async () => {
        const ref = createRef<Adw.Sidebar>();
        const { rerender } = await renderChildren(["Home", "Trash"], buildSidebar(ref));
        await rerender(["Home", "Documents", "Trash"]);
        expect(getItemTitles(ref.current)).toEqual(["Home", "Documents", "Trash"]);
    });
});
