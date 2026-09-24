import type * as GObject from "@gtkx/gi/gobject";
import type { AnyClass } from "@gtkx/utils";
import * as Gtk from "@gtkx/gi/gtk";
import { GMenu } from "@gtkx/jsx/gio";
import { GtkButton, GtkMenuButton } from "@gtkx/jsx/gtk";
import { getHandle, registerClass, wrapHandle } from "@gtkx/runtime";
import { prettyRoles, prettyWidget, render, screen, userEvent } from "@gtkx/testing";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { VBox } from "./widget-fixtures.js";

const ANONYMOUS_TYPE_NAME = "GtkxAnonymousTagProbe";
const AnonymousBox = registerClass(class extends Gtk.Box {}, { typeName: ANONYMOUS_TYPE_NAME });
const OUTPUT_FIXTURE = fileURLToPath(new URL("../fixtures/pretty-widget-output.tsx", import.meta.url));
const OUTPUT_FIXTURE_ARGS = ["--conditions=source", "--import", "tsx", OUTPUT_FIXTURE];
const OUTPUT_FIXTURE_TSCONFIG = fileURLToPath(new URL("../../../../tsconfig.base.json", import.meta.url));
const OUTPUT_FIXTURE_TIMEOUT = 20_000;

const wrapAs = <T extends object>(object: GObject.Object, cls: AnyClass<T>): T => wrapHandle(getHandle(object), cls);

const runOutputFixture = (scenario: "debug" | "logWidget"): string => {
    const result = spawnSync(process.execPath, [...OUTPUT_FIXTURE_ARGS, scenario], {
        encoding: "utf8",
        env: { ...process.env, TSX_TSCONFIG_PATH: OUTPUT_FIXTURE_TSCONFIG },
        timeout: OUTPUT_FIXTURE_TIMEOUT,
    });

    if (result.status !== 0) {
        throw new Error(result.stderr);
    }

    return result.stdout;
};

const outputSection = (output: string, name: string): string =>
    output.split(`BEGIN ${name}\n`)[1]?.split(`END ${name}\n`)[0] ?? "";

const occurrenceCount = (value: string, search: string): number => value.split(search).length - 1;

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

describe("logWidget", () => {
    it("logs the formatted tree, one call per widget, honoring formatting options", () => {
        const output = runOutputFixture("logWidget");
        const single = outputSection(output, "single");
        const list = outputSection(output, "list");

        expect(single).toContain("<Box");
        expect(occurrenceCount(single, 'name="log-root"')).toBe(1);
        expect(occurrenceCount(list, 'name="log-root"')).toBe(2);
        expect(outputSection(output, "empty")).toBe("\n");
    });

    it("is reachable through the render result and through the screen", () => {
        const output = runOutputFixture("debug");

        expect(outputSection(output, "result")).toContain("<Box");
        expect(outputSection(output, "empty")).toBe("\n");
        expect(outputSection(output, "screen")).toContain("<Box");
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
