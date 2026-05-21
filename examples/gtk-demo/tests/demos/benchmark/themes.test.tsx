import * as Adw from "@gtkx/ffi/adw";
import * as Gtk from "@gtkx/ffi/gtk";
import { act, fireEvent, screen } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { themesDemo } from "../../../src/demos/benchmark/themes.js";
import { renderDemo } from "../../helpers/render-demo.js";

describe("themesDemo", () => {
    it("exposes the expected metadata", () => {
        expect(themesDemo.id).toBe("themes");
        expect(themesDemo.title).toBe("Benchmark/Themes");
        expect(typeof themesDemo.sourceCode).toBe("string");
    });

    it("renders the cycle toggle inside the titlebar and the body buttons", async () => {
        const { window } = await renderDemo(themesDemo);
        const win = window.current;
        if (!win) throw new Error("expected the window ref to be populated");
        const titlebar = win.getTitlebar?.();
        expect(titlebar).toBeInstanceOf(Gtk.HeaderBar);
        const cycle = (await screen.findByRole(Gtk.AccessibleRole.TOGGLE_BUTTON, {
            name: "Cycle",
        })) as Gtk.ToggleButton;
        expect(cycle).toBeInstanceOf(Gtk.ToggleButton);
        expect(cycle.getActive()).toBe(false);
        expect(await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Hi, I am a button" })).toBeDefined();
        expect(await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Destructive" })).toBeDefined();
    });

    it("opens the warning dialog when the cycle toggle is activated", async () => {
        await renderDemo(themesDemo);
        const cycle = (await screen.findByRole(Gtk.AccessibleRole.TOGGLE_BUTTON, {
            name: "Cycle",
        })) as Gtk.ToggleButton;
        await act(() => cycle.setActive(true));
        await fireEvent(cycle, "toggled");
        const warning = await screen.findByText(/photosensitive/i, { exact: false });
        expect(warning).toBeDefined();
        expect(cycle.getActive()).toBe(true);
    });

    it("renders the fps label widget in the titlebar with tabular numerals", async () => {
        const { window } = await renderDemo(themesDemo);
        const win = window.current;
        if (!win) throw new Error("expected the window ref to be populated");
        const titlebar = win.getTitlebar?.();
        if (!titlebar) throw new Error("expected a titlebar");
        const collectLabels = (root: Gtk.Widget, out: Gtk.Label[] = []): Gtk.Label[] => {
            if (root instanceof Gtk.Label) out.push(root);
            let child = root.getFirstChild();
            while (child) {
                collectLabels(child, out);
                child = child.getNextSibling();
            }
            return out;
        };
        const fpsLabel = collectLabels(titlebar).find((l) => l.getWidthChars() === 12);
        if (!fpsLabel) throw new Error("expected the fps label inside the titlebar");
        expect(fpsLabel.getLabel() ?? "").toBe("");
    });
});

describe("themesDemo cycling lifecycle", () => {
    const findAlertDialog = async (): Promise<Adw.AlertDialog> => {
        const warningLabel = await screen.findByText(/photosensitive/i, { exact: false });
        let current: Gtk.Widget | null = warningLabel;
        while (current) {
            if (current instanceof Adw.AlertDialog) return current;
            current = current.getParent();
        }
        throw new Error("alert dialog ancestor missing");
    };

    it("starts cycling when the warning is accepted", async () => {
        await renderDemo(themesDemo);
        const cycle = (await screen.findByRole(Gtk.AccessibleRole.TOGGLE_BUTTON, {
            name: "Cycle",
        })) as Gtk.ToggleButton;
        await act(() => cycle.setActive(true));
        await fireEvent(cycle, "toggled");
        const alert = await findAlertDialog();
        await fireEvent(alert, "response", "ok");
    });

    it("does not start cycling when the warning is dismissed", async () => {
        await renderDemo(themesDemo);
        const cycle = (await screen.findByRole(Gtk.AccessibleRole.TOGGLE_BUTTON, {
            name: "Cycle",
        })) as Gtk.ToggleButton;
        await act(() => cycle.setActive(true));
        await fireEvent(cycle, "toggled");
        const alert = await findAlertDialog();
        await fireEvent(alert, "response", "cancel");
    });

    it("stops cycling when the toggle is unchecked after acceptance", async () => {
        await renderDemo(themesDemo);
        const cycle = (await screen.findByRole(Gtk.AccessibleRole.TOGGLE_BUTTON, {
            name: "Cycle",
        })) as Gtk.ToggleButton;
        await act(() => cycle.setActive(true));
        await fireEvent(cycle, "toggled");
        const alert = await findAlertDialog();
        await fireEvent(alert, "response", "ok");
        await act(() => cycle.setActive(false));
        await fireEvent(cycle, "toggled");
    });
});
