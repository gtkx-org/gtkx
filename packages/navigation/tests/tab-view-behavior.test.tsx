import type { NavigationState } from "@react-navigation/core";
import type { ReactNode } from "react";
import * as Adw from "@gtkx/gi/adw";
import * as Gio from "@gtkx/gi/gio";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkLabel } from "@gtkx/jsx/gtk";
import { type TabViewScreenProps, usePreventRemove } from "@gtkx/navigation";
import { act, render, screen, userEvent } from "@gtkx/testing";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { DocumentsApp, focusedTitle, pageTitles } from "./helpers/tab-view-fixtures.js";
import { getAncestor } from "./helpers/widget-ancestors.js";

type DocumentParams = { Document: { title: string } };

const clickButton = async (name: string): Promise<void> => {
    await userEvent.click(await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name }));
};

const viewOf = (text: string): Adw.TabView => getAncestor(screen.getByText(text), Adw.TabView);

const GuardedDocument = ({ route }: TabViewScreenProps<DocumentParams, "Document">): ReactNode => {
    usePreventRemove(true, () => undefined);

    return <GtkLabel>{`${route.params.title} content`}</GtkLabel>;
};

describe("tab view navigator behavior", () => {
    it("keeps a tab whose screen prevents removal", async () => {
        await render(<DocumentsApp screen={GuardedDocument} />);
        await screen.findByText("First content");
        const view = viewOf("First content");

        await act(() => {
            view.closePage(view.getNthPage(0));
        });
        expect(pageTitles(view)).toEqual(["First"]);
        expect(screen.getByText("First content")).toBeRooted();
    });

    it("mounts unfocused tabs when they are first selected", async () => {
        await render(<DocumentsApp />);
        await screen.findByText("First content");
        const view = viewOf("First content");
        await clickButton("Open background sibling of First");
        const host = view.getNthPage(1).getChild();

        expect(host instanceof Adw.Bin ? host.getChild() : undefined).toBeNull();
        await act(() => {
            view.setSelectedPage(view.getNthPage(1));
        });
        await screen.findByText("First background content");
    });

    it("mounts unfocused tabs immediately when lazy is off", async () => {
        await render(<DocumentsApp prefix="Eager" options={{ lazy: false }} />);
        await screen.findByText("Eager content");
        await clickButton("Open background sibling of Eager");
        const host = viewOf("Eager content").getNthPage(1).getChild();

        expect(host instanceof Adw.Bin ? host.getChild() : undefined).not.toBeNull();
    });

    it("applies screen options to the native page", async () => {
        await render(
            <DocumentsApp
                options={{
                    icon: "folder-symbolic",
                    loading: true,
                    needsAttention: true,
                    tooltip: "A tooltip",
                    keyword: "docs",
                    indicatorIcon: Gio.ThemedIcon.new("audio-volume-high-symbolic"),
                    indicatorActivatable: true,
                }}
            />,
        );
        await screen.findByText("First content");
        const page = viewOf("First content").getNthPage(0);
        const icon = page.getIcon();

        expect(icon instanceof Gio.ThemedIcon ? icon.getNames() : []).toContain("folder-symbolic");
        expect(page.getLoading()).toBe(true);
        expect(page.getNeedsAttention()).toBe(true);
        expect(page.getTooltip()).toBe("A tooltip");
        expect(page.getKeyword()).toBe("docs");
        expect(page.getIndicatorActivatable()).toBe(true);
        expect(page.getIndicatorIcon()).not.toBeNull();
    });

    it("reorders tabs through actions and native reordering", async () => {
        const states: (NavigationState | undefined)[] = [];
        await render(<DocumentsApp onStateChange={(state) => states.push(state)} />);
        await screen.findByText("First content");
        const view = viewOf("First content");
        await clickButton("Open sibling of First");
        await screen.findByText("First sibling content");

        await clickButton("Move First sibling first");
        expect(pageTitles(view)).toEqual(["First sibling", "First"]);

        await act(() => {
            view.reorderPage(view.getNthPage(1), 0);
        });
        expect(pageTitles(view)).toEqual(["First", "First sibling"]);
        expect(
            states.at(-1)?.routes.map((route) => focusedTitle({ ...route, routes: [route], index: 0 } as never)),
        ).toEqual(["First", "First sibling"]);
    });

    it("reverts a native selection that a tabPress listener prevents", async () => {
        const states: (NavigationState | undefined)[] = [];
        await render(
            <DocumentsApp
                navigator={{
                    screenListeners: { tabPress: (event: { preventDefault: () => void }) => event.preventDefault() },
                }}
                onStateChange={(state) => states.push(state)}
            />,
        );
        await screen.findByText("First content");
        const view = viewOf("First content");
        await clickButton("Open sibling of First");
        await screen.findByText("First sibling content");

        await act(() => {
            view.setSelectedPage(view.getNthPage(0));
        });
        expect(view.getSelectedPage()?.getTitle()).toBe("First sibling");
        expect(focusedTitle(states.at(-1))).toBe("First sibling");
    });

    it("closes the other unpinned tabs", async () => {
        await render(<DocumentsApp />);
        await screen.findByText("First content");
        const view = viewOf("First content");
        await clickButton("Open sibling of First");
        await screen.findByText("First sibling content");
        await clickButton("Pin First sibling");
        await clickButton("Open sibling of First sibling");
        await screen.findByText("First sibling sibling content");
        await clickButton("Close others of First sibling sibling");

        expect(pageTitles(view)).toEqual(["First sibling", "First sibling sibling"]);
    });

    it("adopts the page a created window receives before its navigator mounts", async () => {
        const Windows = (): ReactNode => {
            const [views, setViews] = useState<Adw.TabView[]>([]);

            return (
                <GtkBox orientation={Gtk.Orientation.VERTICAL}>
                    <DocumentsApp
                        prefix="Main"
                        navigator={{
                            onCreateWindow: () => {
                                const view = new Adw.TabView();
                                setViews((current) => [...current, view]);

                                return view;
                            },
                        }}
                    />
                    {views.map((view, index) => (
                        <DocumentsApp key={index} prefix="Unused" navigator={{ view }} />
                    ))}
                </GtkBox>
            );
        };
        await render(<Windows />);
        await screen.findByText("Main content");
        const main = viewOf("Main content");
        await clickButton("Open sibling of Main");
        await screen.findByText("Main sibling content");
        let target: Adw.TabView | null = null;

        await act(() => {
            target = main.emit("create-window") ?? null;

            if (target !== null) {
                main.transferPage(main.getNthPage(1), target, 0);
            }
        });
        await screen.findByText("Main sibling content");
        expect(target).not.toBeNull();
        expect(pageTitles(main)).toEqual(["Main"]);
        expect(target === null ? [] : pageTitles(target)).toEqual(["Main sibling"]);
        expect(getAncestor(screen.getByText("Main sibling content"), Adw.TabView)).toBe(target);
    });
});
