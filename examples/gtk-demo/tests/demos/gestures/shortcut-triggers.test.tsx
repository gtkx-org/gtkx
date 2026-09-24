import * as Gtk from "@gtkx/gi/gtk";
import { screen, within } from "@gtkx/testing";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { shortcutTriggersDemo } from "../../../src/demos/gestures/shortcut-triggers.js";
import { renderDemo } from "../../test-utils.js";

const OUTPUT_FIXTURE = fileURLToPath(new URL("../../fixtures/shortcut-output.tsx", import.meta.url));
const OUTPUT_FIXTURE_ARGS = ["--conditions=source", "--import", "tsx", OUTPUT_FIXTURE];
const OUTPUT_FIXTURE_TSCONFIG = fileURLToPath(new URL("../../../../../tsconfig.base.json", import.meta.url));

const runShortcut = (scenario: "ctrl-g" | "x"): string => {
    const result = spawnSync(process.execPath, OUTPUT_FIXTURE_ARGS, {
        encoding: "utf8",
        env: {
            ...process.env,
            GTKX_SHORTCUT_SCENARIO: scenario,
            TSX_TSCONFIG_PATH: OUTPUT_FIXTURE_TSCONFIG,
        },
        timeout: 20_000,
    });

    if (result.status !== 0) {
        throw new Error(result.stderr);
    }

    return result.stdout;
};

describe("shortcutTriggersDemo rendering", () => {
    it("renders the two instruction labels in the listbox", async () => {
        await renderDemo(shortcutTriggersDemo);
        const listBox = await screen.findByName("list-box", { as: Gtk.ListBox });
        expect(within(listBox).getAllByRole(Gtk.AccessibleRole.LIST_ITEM)).toHaveLength(2);
        expect(await screen.findByName("label-ctrl-g")).toHaveTextContent("Press Ctrl-G");
        expect(await screen.findByName("label-x")).toHaveTextContent("Press X");
    });

    it("wraps each instruction label in a list box row", async () => {
        await renderDemo(shortcutTriggersDemo);
        const rows = await screen.findAllByRole(Gtk.AccessibleRole.LIST_ITEM, { as: Gtk.ListBoxRow });
        expect(rows).toHaveLength(2);
        expect(rows[0]).toContainElement(await screen.findByName("label-ctrl-g"));
        expect(rows[1]).toContainElement(await screen.findByName("label-x"));
    });

    it("applies the 6px margins on the listbox container", async () => {
        await renderDemo(shortcutTriggersDemo);
        const listBox = await screen.findByName("list-box", { as: Gtk.ListBox });
        expect(listBox).toHaveObjectProperty("marginTop", 6);
        expect(listBox).toHaveObjectProperty("marginBottom", 6);
        expect(listBox).toHaveObjectProperty("marginStart", 6);
        expect(listBox).toHaveObjectProperty("marginEnd", 6);
    });
});

describe("shortcutTriggersDemo activation", () => {
    it.each([
        ["ctrl-g", "activated Press Ctrl-G"],
        ["x", "activated Press X"],
    ] as const)("activates the %s shortcut", (scenario, output) => {
        expect(runShortcut(scenario).trim()).toBe(output);
    });
});
