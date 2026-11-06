import type { NavigationAction, NavigationState } from "@react-navigation/core";
import type { ReactNode, Ref } from "react";
import * as Adw from "@gtkx/gi/adw";
import * as Gio from "@gtkx/gi/gio";
import { GMenu } from "@gtkx/jsx/gio";
import { GtkBox } from "@gtkx/jsx/gtk";
import { act, render, screen, waitFor } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { clickButton, DocumentsApp, focusedTitle, pageTitles, viewOf } from "./helpers/tab-view-fixtures.js";
import { getAncestor } from "./helpers/widget-ancestors.js";

describe("tab view navigator", () => {
    it("opens the initial tab and renders its content", async () => {
        const states: (NavigationState | undefined)[] = [];
        await render(<DocumentsApp onStateChange={(state) => states.push(state)} />);

        await screen.findByText("First content");
        const view = viewOf("First content");
        expect(pageTitles(view)).toEqual(["First"]);
        expect(view.getSelectedPage()?.getTitle()).toBe("First");
    });

    it("opens, selects and closes tabs through actions", async () => {
        const states: (NavigationState | undefined)[] = [];
        await render(<DocumentsApp onStateChange={(state) => states.push(state)} />);
        await screen.findByText("First content");
        const view = viewOf("First content");

        await clickButton("Open child of First");
        await screen.findByText("First child content");
        expect(pageTitles(view)).toEqual(["First", "First child"]);
        expect(view.getSelectedPage()?.getTitle()).toBe("First child");
        expect(focusedTitle(states.at(-1))).toBe("First child");

        await clickButton("Close First child");
        expect(pageTitles(view)).toEqual(["First"]);
        expect(view.getSelectedPage()?.getTitle()).toBe("First");
        expect(focusedTitle(states.at(-1))).toBe("First");
    });

    it("follows native selection and closing", async () => {
        const states: (NavigationState | undefined)[] = [];
        await render(<DocumentsApp onStateChange={(state) => states.push(state)} />);
        await screen.findByText("First content");
        const view = viewOf("First content");
        await clickButton("Open sibling of First");
        await screen.findByText("First sibling content");

        await act(() => {
            view.setSelectedPage(view.getNthPage(0));
        });
        expect(focusedTitle(states.at(-1))).toBe("First");

        await act(() => {
            view.closePage(view.getNthPage(1));
        });
        expect(pageTitles(view)).toEqual(["First"]);
        expect(states.at(-1)?.routes).toHaveLength(1);
    });

    it("leaves closing the last tab to the container", async () => {
        const unhandled: NavigationAction[] = [];
        await render(<DocumentsApp onUnhandledAction={(action) => unhandled.push(action)} />);
        await screen.findByText("First content");
        const view = viewOf("First content");

        await clickButton("Close First");
        expect(unhandled.map((action) => action.type)).toEqual(["CLOSE_TAB"]);
        expect(pageTitles(view)).toEqual(["First"]);

        await act(() => {
            view.closePage(view.getNthPage(0));
        });
        expect(unhandled).toHaveLength(2);
        expect(pageTitles(view)).toEqual(["First"]);
    });

    it("replaces the last tab with a new tab of the initial route when replaceLastTab is set", async () => {
        const unhandled: NavigationAction[] = [];
        await render(
            <DocumentsApp
                navigator={{ replaceLastTab: true }}
                onUnhandledAction={(action) => unhandled.push(action)}
            />,
        );
        await screen.findByText("First content");
        const view = viewOf("First content");
        await clickButton("Open sibling of First");
        await screen.findByText("First sibling content");

        await act(() => {
            view.closePage(view.getNthPage(0));
        });
        expect(pageTitles(view)).toEqual(["First sibling"]);

        await act(() => {
            view.closePage(view.getNthPage(0));
        });
        await screen.findByText("First content");
        expect(pageTitles(view)).toEqual(["First"]);
        expect(view.getSelectedPage()?.getTitle()).toBe("First");
        expect(unhandled).toEqual([]);
    });

    it("creates a tab from the overview's new tab button", async () => {
        await render(
            <DocumentsApp
                navigator={{
                    overview: {
                        open: true,
                        enableNewTab: true,
                        onCreateTab: () => ({ name: "Document", params: { title: "Created" } }),
                    },
                }}
            />,
        );
        await screen.findByText("First content");
        const view = viewOf("First content");

        await clickButton("New Tab");
        await screen.findByText("Created content");
        expect(pageTitles(view)).toEqual(["First", "Created"]);
    });

    it("pins a tab ahead of the others", async () => {
        await render(<DocumentsApp />);
        await screen.findByText("First content");
        const view = viewOf("First content");
        await clickButton("Open sibling of First");
        await screen.findByText("First sibling content");

        await clickButton("Pin First sibling");
        expect(pageTitles(view)).toEqual(["First sibling", "First"]);
        expect(view.getNthPage(0).getPinned()).toBe(true);
    });

    it("uses the menu that renderMenu attaches its ref to as the tab context menu", async () => {
        const TabMenu = ({ menuRef, labels }: { menuRef: Ref<Gio.Menu>; labels: string[] }): ReactNode => (
            <GMenu ref={menuRef} items={labels.map((label) => ({ label, action: "win.close-others" }))} />
        );
        const draw = (labels: string[] | null): ReactNode => (
            <DocumentsApp
                navigator={labels === null ? {} : { renderMenu: (ref) => <TabMenu menuRef={ref} labels={labels} /> }}
            />
        );
        const { rerender } = await render(draw(["Close Other Tabs"]));
        await screen.findByText("First content");
        const view = viewOf("First content");

        await waitFor(() => {
            expect(view.getMenuModel()?.getNItems()).toBe(1);
        });
        const menu = view.getMenuModel();

        await rerender(draw(["Close Other Tabs", "Pin"]));
        expect(view.getMenuModel()).toBe(menu);
        expect(menu?.getNItems()).toBe(2);

        await rerender(draw(null));
        expect(view.getMenuModel()).toBeNull();
    });

    it("rejects both menuModel and renderMenu", async () => {
        await expect(
            render(
                <DocumentsApp
                    navigator={{ menuModel: new Gio.Menu(), renderMenu: (ref) => <GMenu ref={ref} items={[]} /> }}
                />,
            ),
        ).rejects.toThrow("menuModel or renderMenu");
    });

    it("moves a tab between two navigators", async () => {
        const Twin = (): ReactNode => (
            <GtkBox>
                <DocumentsApp prefix="Left" />
                <DocumentsApp prefix="Right" />
            </GtkBox>
        );
        await render(<Twin />);
        await screen.findByText("Left content");
        await screen.findByText("Right content");
        const left = viewOf("Left content");
        const right = viewOf("Right content");
        await clickButton("Open sibling of Left");
        await screen.findByText("Left sibling content");

        await act(() => {
            left.transferPage(left.getNthPage(1), right, 1);
        });
        await screen.findByText("Left sibling content");
        expect(pageTitles(left)).toEqual(["Left"]);
        expect(pageTitles(right)).toEqual(["Right", "Left sibling"]);
        expect(getAncestor(screen.getByText("Left sibling content"), Adw.TabView)).toBe(right);
    });
});
