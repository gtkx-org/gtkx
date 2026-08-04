import * as Adw from "@gtkx/gi/adw";
import * as Gtk from "@gtkx/gi/gtk";
import { screen, userEvent, waitFor, within } from "@gtkx/testing";
import { describe, expect, it, vi } from "vitest";
import { themesDemo } from "../../../src/demos/benchmark/themes.js";
import { getChildren, renderDemo } from "../../test-utils.js";

type CycleContext = {
    cycle: Gtk.ToggleButton;
    alert: Adw.AlertDialog;
    header: Gtk.HeaderBar;
    window: Gtk.Window;
};

const THEME_TITLES = ["Adwaita", "Adwaita (dark)", "HighContrast", "HighContrastInverse"];
const FPS_SETTLE_MS = 1200;
const FPS_PATTERN = /^\d+\.\d{2} fps$/;

const renderThemesHeader = async (): Promise<Gtk.HeaderBar> => {
    await renderDemo(themesDemo);

    return await screen.findByName("themes-header", { as: Gtk.HeaderBar });
};

const getCycleToggle = (header: Gtk.HeaderBar): Gtk.ToggleButton =>
    within(header).getByRole(Gtk.AccessibleRole.TOGGLE_BUTTON, { name: "Cycle", as: Gtk.ToggleButton });

const respondToWarning = async (alert: Adw.AlertDialog, response: string): Promise<void> => {
    await userEvent.click(within(alert).getByRole(Gtk.AccessibleRole.BUTTON, { name: response }));
};

const activateCycleAndAwaitAlert = async (): Promise<CycleContext> => {
    const header = await renderThemesHeader();
    const window = await screen.findByRole(Gtk.AccessibleRole.WINDOW, { as: Gtk.Window });
    const cycle = getCycleToggle(header);
    await userEvent.click(cycle);
    const alert = await screen.findByName("warning-dialog", { as: Adw.AlertDialog });

    return { cycle, alert, header, window };
};

const queryFpsLabel = (header: Gtk.HeaderBar): Gtk.Label | null =>
    within(header).queryByRole(Gtk.AccessibleRole.LABEL, { name: FPS_PATTERN, as: Gtk.Label });

const waitForFpsReadout = async (header: Gtk.HeaderBar): Promise<void> => {
    await waitFor(() => {
        const fpsLabel = queryFpsLabel(header);

        if (!fpsLabel) {
            throw new Error("fps label not yet populated");
        }

        expect(fpsLabel.getLabel()).toMatch(FPS_PATTERN);
    });
};

vi.setConfig({ testTimeout: 30_000 });

describe("themesDemo", () => {
    it("exposes the expected metadata", () => {
        expect(themesDemo.id).toBe("themes");
        expect(themesDemo.title).toBe("Benchmark/Themes");
        expect(themesDemo.description.length).toBeGreaterThan(0);
        expect(typeof themesDemo.sourceCode).toBe("string");
        expect(themesDemo.isResizable).toBe(false);
        expect(themesDemo.component).toBeTypeOf("function");
    });

    it("renders the cycle toggle inside the titlebar and the linked body buttons", async () => {
        const header = await renderThemesHeader();
        expect(getCycleToggle(header)).not.toBePressed();

        const firstLinked = await screen.findByRole(Gtk.AccessibleRole.BUTTON, {
            name: "Hi, I am a button",
            as: Gtk.Button,
        });

        const linkedBox = firstLinked.getParent() as Gtk.Box;
        expect(linkedBox).toHaveClass("linked");
        const linkedLabels = getChildren(linkedBox).map((child) => (child as Gtk.Button).getLabel());
        expect(linkedLabels).toEqual(["Hi, I am a button", "And I'm another button", "This is a button party!"]);
    });

    it("applies destructive and suggested style classes to the body buttons", async () => {
        await renderDemo(themesDemo);

        const destructive = await screen.findByRole(Gtk.AccessibleRole.BUTTON, {
            name: "Destructive",
            as: Gtk.Button,
        });

        const suggested = await screen.findByRole(Gtk.AccessibleRole.BUTTON, {
            name: "Suggested",
            as: Gtk.Button,
        });

        expect(destructive).toHaveClass("destructive-action");
        expect(suggested).toHaveClass("suggested-action");
    });

    it("opens the warning dialog and exposes the photosensitive warning text", async () => {
        const { cycle, alert } = await activateCycleAndAwaitAlert();
        expect(alert).toHaveObjectProperty("heading", "Warning");
        expect(alert.getBody()).toMatch(/photosensitive/i);
        expect(cycle).toBePressed();
    });
});

describe("themesDemo cycling lifecycle", () => {
    it("cycles themes and drives the fps readout after acceptance", async () => {
        const { cycle, alert, header, window } = await activateCycleAndAwaitAlert();
        expect(window).toHaveObjectProperty("title", null);
        expect(queryFpsLabel(header)).toBeNull();
        await respondToWarning(alert, "OK");

        await waitFor(() => {
            expect(screen.queryByName("warning-dialog")).toBeNull();
        });

        expect(cycle).toBePressed();

        await waitFor(() => {
            expect(THEME_TITLES).toContain(window.getTitle());
        });

        await waitForFpsReadout(header);
    });

    it("does not start cycling when the warning is cancelled", async () => {
        const { alert, header, window } = await activateCycleAndAwaitAlert();
        await respondToWarning(alert, "Cancel");

        await waitFor(() => {
            expect(screen.queryByName("warning-dialog")).toBeNull();
        });

        await new Promise((resolve) => setTimeout(resolve, FPS_SETTLE_MS));
        expect(window).toHaveObjectProperty("title", null);
        expect(queryFpsLabel(header)).toBeNull();
    });

    it("stops cycling, clears the fps readout, and unpresses the toggle when unchecked", async () => {
        const { cycle, alert, header } = await activateCycleAndAwaitAlert();
        await respondToWarning(alert, "OK");

        await waitFor(() => {
            expect(cycle).toBePressed();
        });

        await waitForFpsReadout(header);
        await userEvent.click(cycle);

        await waitFor(() => {
            expect(cycle).not.toBePressed();
        });

        expect(screen.queryByName("warning-dialog")).toBeNull();

        await waitFor(() => {
            expect(queryFpsLabel(header)).toBeNull();
        });
    });
});
