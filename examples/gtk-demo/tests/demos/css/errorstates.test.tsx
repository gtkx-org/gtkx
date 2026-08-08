import * as Adw from "@gtkx/gi/adw";
import * as Gtk from "@gtkx/gi/gtk";
import { screen, userEvent } from "@gtkx/testing";
import { describe, expect, it, vi } from "vitest";
import { errorstatesDemo } from "../../../src/demos/css/errorstates.js";
import { renderDemo } from "../../test-utils.js";

type DetailEntries = {
    detailsEntry: Gtk.Entry;
    moreDetailsEntry: Gtk.Entry;
};

const renderAndFlagMoreDetails = async (): Promise<DetailEntries> => {
    await renderDemo(errorstatesDemo);
    const detailsEntry = await screen.findByLabelText("Details", { as: Gtk.Entry });
    const moreDetailsEntry = screen.getByLabelText("More Details", { as: Gtk.Entry });
    await userEvent.type(moreDetailsEntry, "filled in");

    return { detailsEntry, moreDetailsEntry };
};

const renderSwitch = async (): Promise<Gtk.Switch> => {
    await renderDemo(errorstatesDemo);

    return await screen.findByRole(Gtk.AccessibleRole.SWITCH, { as: Gtk.Switch });
};

const renderScaleAndSwitch = async (): Promise<{ scale: Gtk.Scale; sw: Gtk.Switch }> => {
    await renderDemo(errorstatesDemo);
    const scale = await screen.findByRole(Gtk.AccessibleRole.SLIDER, { as: Gtk.Scale });
    const sw = await screen.findByRole(Gtk.AccessibleRole.SWITCH, { as: Gtk.Switch });

    return { scale, sw };
};

const findLevelErrorLabel = async (): Promise<Gtk.Label> =>
    await screen.findByRole(Gtk.AccessibleRole.LABEL, { name: "Level too low", as: Gtk.Label });

describe("errorstatesDemo metadata", () => {
    it("exposes the expected metadata", () => {
        expect(errorstatesDemo.id).toBe("errorstates");
        expect(errorstatesDemo.title).toBe("Error States");
        expect(errorstatesDemo.description.length).toBeGreaterThan(0);
        expect(errorstatesDemo.keywords).toEqual([]);
        expect(typeof errorstatesDemo.sourceCode).toBe("string");
        expect(errorstatesDemo.sourceCode?.length ?? 0).toBeGreaterThan(0);
        expect(errorstatesDemo.component).toBeTypeOf("function");
    });

    it("renders both entries, the scale and the switch in initial state", async () => {
        await renderDemo(errorstatesDemo);
        const entries = await screen.findAllByRole(Gtk.AccessibleRole.TEXT_BOX);
        expect(entries).toHaveLength(2);
        const scale = await screen.findByRole(Gtk.AccessibleRole.SLIDER, { value: { now: 50 }, as: Gtk.Scale });
        expect(scale.getValue()).toBe(50);
        const sw = await screen.findByRole(Gtk.AccessibleRole.SWITCH, { checked: false, as: Gtk.Switch });
        expect(sw).toHaveObjectProperty("state", false);
    });
});

describe("errorstatesDemo entries", () => {
    it("flags the more-details entry as invalid when filled while details is empty", async () => {
        const { moreDetailsEntry } = await renderAndFlagMoreDetails();
        expect(moreDetailsEntry).toHaveClass("error");
        expect(moreDetailsEntry).toHaveObjectProperty("tooltipText", "Must have details first");
        expect(moreDetailsEntry).toBeInvalid();
    });

    it("clears the more-details error once the details entry receives input", async () => {
        const { detailsEntry, moreDetailsEntry } = await renderAndFlagMoreDetails();
        expect(moreDetailsEntry).toHaveClass("error");
        await userEvent.type(detailsEntry, "ok");
        expect(moreDetailsEntry).not.toHaveClass("error");
        expect(moreDetailsEntry).toHaveObjectProperty("tooltipText", null);
        expect(moreDetailsEntry).toBeValid();
    });
});

describe("errorstatesDemo switch and scale", () => {
    it("shows the level-too-low error label and flags the switch invalid when activated with a low level", async () => {
        const sw = await renderSwitch();
        expect(sw).toBeValid();
        await userEvent.click(sw);
        const errorLabel = await findLevelErrorLabel();
        expect(errorLabel).toHaveClass("error");
        expect(sw).toBeInvalid();
        expect(sw).toHaveAccessibleErrorMessage("Level too low");
    });

    it("activates the switch through the Control+M keyboard shortcut", async () => {
        const sw = await renderSwitch();
        sw.grabFocus();
        await userEvent.keyboard(sw, "{Control>}m{/Control}");
        expect(sw).toHaveObjectProperty("active", true);
        const errorLabel = await findLevelErrorLabel();
        expect(errorLabel).toHaveClass("error");
        expect(sw).toBeInvalid();
    });

    it("does not show the error label when the switch is activated with a high level", async () => {
        const { scale, sw } = await renderScaleAndSwitch();
        await userEvent.slide(scale, 80);
        await userEvent.click(sw);
        expect(sw).toHaveObjectProperty("state", true);
        expect(screen.queryByRole(Gtk.AccessibleRole.LABEL, { name: "Level too low" })).toBeNull();
        expect(sw).toBeValid();
    });

    it("flips the switch state automatically when the level crosses 50 with the switch already active", async () => {
        const { scale, sw } = await renderScaleAndSwitch();
        await userEvent.click(sw);
        await userEvent.slide(scale, 80);
        expect(sw).toHaveObjectProperty("state", true);
        await userEvent.slide(scale, 20);
        expect(sw).toHaveObjectProperty("state", false);
    });
});

describe("errorstatesDemo dialog lifecycle", () => {
    it("fires the onClose callback when the dialog is closed", async () => {
        const onClose = vi.fn();
        await renderDemo(errorstatesDemo, { onClose });
        const dialog = await screen.findByRole(Gtk.AccessibleRole.DIALOG, { as: Adw.Dialog });
        expect(onClose).not.toHaveBeenCalled();
        dialog.close();
        expect(onClose).toHaveBeenCalledTimes(1);
    });
});
