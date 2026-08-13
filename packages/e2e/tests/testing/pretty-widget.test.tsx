import type * as GObject from "@gtkx/gi/gobject";
import type { AnyClass } from "@gtkx/utils";
import * as Gtk from "@gtkx/gi/gtk";
import { GMenu } from "@gtkx/jsx/gio";
import { GtkButton, GtkMenuButton } from "@gtkx/jsx/gtk";
import { getHandle, registerClass, wrapHandle } from "@gtkx/runtime";
import { logWidget, prettyRoles, prettyWidget, render, screen, userEvent } from "@gtkx/testing";
import { afterEach, describe, expect, it, vi } from "vitest";
import { VBox } from "./widget-fixtures.js";

const ANONYMOUS_TYPE_NAME = "GtkxAnonymousTagProbe";
const AnonymousBox = registerClass(class extends Gtk.Box {}, { typeName: ANONYMOUS_TYPE_NAME });

const spyOnConsoleLog = () => vi.spyOn(console, "log").mockImplementation(vi.fn());
const wrapAs = <T extends object>(object: GObject.Object, cls: AnyClass<T>): T => wrapHandle(getHandle(object), cls);

const openMenuPopover = async (): Promise<Gtk.Widget> => {
    await render(
        <GtkMenuButton
            tooltipText="Main Menu"
            menuModel={<GMenu items={[{ label: "New Task", action: "win.missing" }]} />}
        />,
    );

    await userEvent.click(screen.getByRole(Gtk.AccessibleRole.BUTTON, { name: "Main Menu" }));
    const item = await screen.findByRole(Gtk.AccessibleRole.MENU_ITEM, { name: "New Task" });

    for (let ancestor = item.getParent(); ancestor !== null; ancestor = ancestor.getParent()) {
        if (ancestor instanceof Gtk.Popover) {
            return ancestor;
        }
    }

    throw new Error("The menu item is not inside a popover");
};

class UnregisteredButton extends Gtk.Button {}

afterEach(() => {
    vi.restoreAllMocks();
});

describe("logWidget", () => {
    it("logs the formatted tree, one call per widget, honoring formatting options", async () => {
        const { container } = await render(
            <VBox>
                <GtkButton label="One" />
                <GtkButton label="Two" />
            </VBox>,
        );

        const log = spyOnConsoleLog();
        logWidget(container);
        expect(log).toHaveBeenCalledTimes(1);
        expect(log.mock.calls[0]?.[0]).toContain("button");
        logWidget([container, container]);
        expect(log).toHaveBeenCalledTimes(3);
        logWidget(container, { maxLength: 0 });
        expect(log).toHaveBeenLastCalledWith("");
    });

    it("is reachable through the render result and through the screen", async () => {
        const { container, debug } = await render(<GtkButton label="Default" />);
        const log = spyOnConsoleLog();
        debug();
        expect(log.mock.calls[0]?.[0]).toContain("button");
        debug(container, { maxLength: 0 });
        expect(log).toHaveBeenLastCalledWith("");
        screen.debug();
        expect(log).toHaveBeenCalledTimes(3);
    });
});

describe("prettyWidget", () => {
    it("summarizes descendants past maxDepth and renders them in full otherwise", async () => {
        const { container } = await render(
            <VBox>
                <VBox>
                    <GtkButton label="Deep" />
                </VBox>
            </VBox>,
        );

        const shallow = prettyWidget(container, { maxDepth: 1 });
        expect(shallow).toContain("child widget");
        expect(shallow).toContain("hidden");
        expect(shallow).not.toContain("Deep");
        expect(prettyWidget(container)).toContain("Deep");
    });

    it("names widgets that have no generated wrapper class after their own GType", async () => {
        const dump = prettyWidget(await openMenuPopover(), { shouldHighlight: false });
        expect(dump).toContain("<GtkModelButton");
        expect(dump).toContain("</GtkModelButton>");
        expect(dump).toContain("<GtkPopoverContent");
        expect(dump).not.toContain("< ");
        expect(dump).not.toContain("</>");
    });

    it("names a widget whose registered wrapper class is anonymous by its GType", () => {
        const dump = prettyWidget(new AnonymousBox(), { shouldHighlight: false });
        expect(dump).toContain(`<${ANONYMOUS_TYPE_NAME}`);
        expect(dump).not.toContain("< ");
    });

    it("names an instance wrapped as a class carrying no GType after that class", async () => {
        await render(<GtkButton label="Wrapped" />);
        const button = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Wrapped" });
        const dump = prettyWidget(wrapAs(button, UnregisteredButton), { shouldHighlight: false });
        expect(dump).toContain("<UnregisteredButton");
        expect(dump).toContain("</UnregisteredButton>");
    });
});

describe("prettyRoles", () => {
    it("names widgets with no generated wrapper class next to their role", async () => {
        const output = prettyRoles(await openMenuPopover());
        expect(output).toContain('<GtkModelButton role="menu_item">');
        expect(output).toContain('<GtkPopoverContent role="generic">');
    });
});
