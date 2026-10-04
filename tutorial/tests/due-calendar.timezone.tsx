import * as Adw from "@gtkx/gi/adw";
import * as Gtk from "@gtkx/gi/gtk";
import { rootElement } from "@gtkx/react";
import { render, screen, userEvent, waitFor, within } from "@gtkx/testing";
import { expect, it } from "vitest";
import { App } from "../src/app.js";

const openWaterThePlants = async (): Promise<void> => {
    const row = await screen.findByRole(Gtk.AccessibleRole.LIST_ITEM, { name: /Water the plants/ });
    await userEvent.click(row);
    await screen.findByText("Notes");
};

const dueRow = (): Adw.ActionRow =>
    screen.getByRole(Gtk.AccessibleRole.LIST_ITEM, { name: /^Due/, as: Adw.ActionRow });

const dueMenu = (): Gtk.MenuButton =>
    within(dueRow()).getByRole(Gtk.AccessibleRole.BUTTON, { as: Gtk.MenuButton });

const dateParts = (calendar: Gtk.Calendar): [number, number, number] => {
    const date = calendar.getDate();

    return [date.getYear(), date.getMonth(), date.getDayOfMonth()];
};

it("keeps the selected local due date across task editor remounts", async () => {
    await render(<App />, { container: rootElement });
    await openWaterThePlants();
    await userEvent.click(within(dueRow()).getByRole(Gtk.AccessibleRole.BUTTON, { name: "Clear due date" }));
    await userEvent.click(dueMenu());
    const calendar = await screen.findByLabelText("Due", { as: Gtk.Calendar });
    const [year, month] = dateParts(calendar);
    await userEvent.click(within(calendar).getByText("20"));
    await waitFor(() => {
        expect(dueMenu()).not.toHaveAccessibleName("Set date");
    });
    const selected: [number, number, number] = [year, month, 20];
    expect(dateParts(calendar)).toEqual(selected);

    await userEvent.click(dueMenu());
    await userEvent.click(screen.getByRole(Gtk.AccessibleRole.BUTTON, { name: "Back" }));
    await openWaterThePlants();
    await userEvent.click(dueMenu());
    const reopened = await screen.findByLabelText("Due", { as: Gtk.Calendar });
    expect(dateParts(reopened)).toEqual(selected);

    await userEvent.click(dueMenu());
    await userEvent.click(within(dueRow()).getByRole(Gtk.AccessibleRole.BUTTON, { name: "Clear due date" }));
    await waitFor(() => {
        expect(dueMenu()).toHaveAccessibleName("Set date");
    });
    await userEvent.click(screen.getByRole(Gtk.AccessibleRole.BUTTON, { name: "Back" }));
    await openWaterThePlants();
    expect(dueMenu()).toHaveAccessibleName("Set date");
    expect(within(dueRow()).queryByRole(Gtk.AccessibleRole.BUTTON, { name: "Clear due date" })).toBeNull();
});
