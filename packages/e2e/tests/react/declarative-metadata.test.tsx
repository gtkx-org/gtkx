import type { AdwAboutDialogProps, AdwTabBarProps } from "@gtkx/jsx/adw";
import * as Adw from "@gtkx/gi/adw";
import * as Gdk from "@gtkx/gi/gdk";
import * as GObject from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import { AdwAboutDialog, AdwTabBar, AdwTabOverview, AdwTabPage, AdwTabView } from "@gtkx/jsx/adw";
import { GtkBox, GtkCustomLayout, GtkLabel } from "@gtkx/jsx/gtk";
import { rootElement } from "@gtkx/react";
import { queryAllControllers, render, userEvent, within } from "@gtkx/testing";
import { createRef, useState } from "react";
import { describe, expect, it } from "vitest";

const metadata = () => ({
    links: [{ title: "Project manual", url: "https://example.org/manual" }],
    creditSections: [{ name: "Engineering", people: ["Ada Lovelace"] }],
    acknowledgementSections: [{ name: "Supporters", people: ["Grace Hopper"] }],
    legalSections: [{ title: "Sample data", copyright: "Copyright Example", licenseType: Gtk.License.MIT_X11 }],
    otherApps: [{ appid: "org.example.Related", name: "Related Application", summary: "Another useful tool" }],
});

describe("declarative native metadata", () => {
    it("keeps a custom layout while updating its measurement callbacks", async () => {
        const widget = createRef<Gtk.Box>();
        const layout = createRef<Gtk.CustomLayout>();
        const content = (size: number) => (
            <GtkBox
                ref={widget}
                layoutManager={
                    <GtkCustomLayout ref={layout} measure={() => [size, size, -1, -1]} allocate={() => {}} />
                }
            />
        );
        const { rerender } = await render(content(31));
        const original = layout.current;
        expect(widget.current?.measure(Gtk.Orientation.HORIZONTAL, -1)).toEqual([31, 31, -1, -1]);
        await rerender(content(85));
        expect(layout.current).toBe(original);
        expect(widget.current?.measure(Gtk.Orientation.HORIZONTAL, -1)).toEqual([85, 85, -1, -1]);
    });

    it("updates text direction and restores the toolkit default when omitted", async () => {
        const ref = createRef<Gtk.Label>();
        const { rerender } = await render(
            <GtkLabel ref={ref} textDirection={Gtk.TextDirection.RTL}>
                Direction
            </GtkLabel>,
        );
        expect(ref.current?.getDirection()).toBe(Gtk.TextDirection.RTL);
        await rerender(
            <GtkLabel ref={ref} textDirection={Gtk.TextDirection.LTR}>
                Direction
            </GtkLabel>,
        );
        expect(ref.current?.getDirection()).toBe(Gtk.TextDirection.LTR);
        await rerender(<GtkLabel ref={ref}>Direction</GtkLabel>);
        expect(ref.current?.getDirection()).toBe(Gtk.Widget.getDefaultDirection());
    });

    it("shows each About section once after an equivalent metadata rerender", async () => {
        const ref = createRef<Adw.AboutDialog>();
        const content = () => <AdwAboutDialog ref={ref} applicationName="Example" {...metadata()} />;
        const { rerender } = await render(content(), { container: rootElement });
        await rerender(content());
        const dialog = ref.current;
        if (!dialog) throw new Error("About dialog was not created");
        const queries = within(dialog);
        expect(queries.getAllByText("Related Application")).toHaveLength(1);
        await userEvent.click(queries.getByText("Details"));
        expect(queries.getAllByText("Project manual")).toHaveLength(1);
        await userEvent.click(queries.getByRole(Gtk.AccessibleRole.BUTTON, { name: "Back" }));
        await userEvent.click(queries.getByText("Credits"));
        expect(queries.getAllByText("Engineering")).toHaveLength(1);
        expect(queries.getAllByText("Ada Lovelace")).toHaveLength(1);
        await userEvent.click(queries.getByRole(Gtk.AccessibleRole.BUTTON, { name: "Back" }));
        await userEvent.click(queries.getByText("Acknowledgements"));
        expect(queries.getAllByText("Supporters")).toHaveLength(1);
        expect(queries.getAllByText("Grace Hopper")).toHaveLength(1);
        await userEvent.click(queries.getByRole(Gtk.AccessibleRole.BUTTON, { name: "Back" }));
        await userEvent.click(queries.getByText("Legal"));
        expect(queries.getAllByText("Sample data")).toHaveLength(1);
        expect(queries.getAllByText(/Copyright Example/)).toHaveLength(1);
    });

    it.each(["links", "creditSections", "acknowledgementSections", "legalSections", "otherApps"] as const)(
        "requires a new dialog when populated %s are removed",
        async (name) => {
            const props: AdwAboutDialogProps = metadata();
            const { rerender } = await render(<AdwAboutDialog applicationName="Example" {...props} />, {
                container: rootElement,
            });
            await expect(
                rerender(<AdwAboutDialog applicationName="Example" {...props} {...{ [name]: [] }} />),
            ).rejects.toThrow();
        },
    );

    it.each([false, true])("configures, updates and clears extra drops with overview=%s", async (overview) => {
        const container = createRef<Gtk.Box>();
        const App = ({ target }: { target?: AdwTabBarProps["extraDropTarget"] }) => {
            const [view, setView] = useState<Adw.TabView | null>(null);
            const tabs = (
                <AdwTabView ref={setView}>
                    <AdwTabPage title="Drop Destination">
                        <GtkLabel>Content</GtkLabel>
                    </AdwTabPage>
                </AdwTabView>
            );
            const dropProps = {
                view: view ?? undefined,
                extraDropTarget: target,
            };
            return (
                <GtkBox ref={container} orientation={Gtk.Orientation.VERTICAL}>
                    {overview ? (
                        <AdwTabOverview {...dropProps} open={view !== null}>
                            {tabs}
                        </AdwTabOverview>
                    ) : (
                        <>
                            <AdwTabBar {...dropProps} autohide={false} />
                            {tabs}
                        </>
                    )}
                </GtkBox>
            );
        };
        const { rerender } = await render(
            <App target={{ actions: Gdk.DragAction.COPY, types: [GObject.TYPE_STRING] }} />,
        );
        const targets: Gtk.DropTarget[] = [];
        const visit = (widget: Gtk.Widget) => {
            targets.push(...queryAllControllers(widget, Gtk.DropTarget));
            for (let child = widget.getFirstChild(); child; child = child.getNextSibling()) visit(child);
        };
        if (!container.current) throw new Error("The tab container was not created");
        visit(container.current);
        const target = targets.find((controller) => controller.getGtypes()?.includes(GObject.TYPE_STRING));
        if (!target) throw new Error("Extra drop target was not configured");
        expect(target.getActions()).toBe(Gdk.DragAction.COPY);
        await rerender(<App target={{ actions: Gdk.DragAction.MOVE, types: [GObject.TYPE_INT] }} />);
        expect(target.getGtypes()).toEqual([GObject.TYPE_INT]);
        expect(target.getActions()).toBe(Gdk.DragAction.MOVE);
        await rerender(<App />);
        expect(target.getGtypes() ?? []).toEqual([]);
        expect(target.getActions()).toBe(0);
    });
});
