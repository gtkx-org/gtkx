import * as Gtk from "@gtkx/gi/gtk";
import { render, screen, userEvent, waitFor } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { springsDemo } from "../src/demos/springs.js";

const { component: SpringsDemo } = springsDemo;
const ANIMATED = { areAnimationsEnabled: true };

const findCard = async (): Promise<Gtk.Label> => await screen.findByName("springs-label", { as: Gtk.Label });

const clickToggle = async (): Promise<void> => {
    await userEvent.click(screen.getByName("springs-toggle", { as: Gtk.ToggleButton }));
};

const expectSettled = (card: Gtk.Label, opacity: number, marginStart: number): Promise<void> =>
    waitFor(() => {
        expect(card.getOpacity()).toBeCloseTo(opacity, 2);
        expect(card).toHaveObjectProperty("marginStart", marginStart);
    });

const expectInFlight = (card: Gtk.Label): Promise<void> =>
    waitFor(() => {
        const margin = card.getMarginStart();
        expect(margin).toBeGreaterThan(0);
        expect(margin).toBeLessThan(160);
    });

const recordMarginWrites = (card: Gtk.Label): number[] => {
    const seen: number[] = [];

    card.on("notify::margin-start", () => {
        seen.push(card.getMarginStart());
    });

    return seen;
};

describe("springs demo", () => {
    it("slides the card to the hidden target and back", async () => {
        await render(<SpringsDemo />, ANIMATED);
        const card = await findCard();
        await expectSettled(card, 1, 0);
        await clickToggle();
        await expectSettled(card, 0.25, 160);
        await clickToggle();
        await expectSettled(card, 1, 0);
    }, 15_000);

    it("returns to the shown target when toggled mid-flight", async () => {
        await render(<SpringsDemo />, ANIMATED);
        const card = await findCard();
        await clickToggle();
        await expectInFlight(card);
        await clickToggle();
        await expectSettled(card, 1, 0);
    }, 15_000);

    it("replays the animation with the selected preset", async () => {
        await render(<SpringsDemo />, ANIMATED);
        const card = await findCard();
        await expectSettled(card, 1, 0);
        await userEvent.click(screen.getByName("preset-wobbly", { as: Gtk.Button }));

        await waitFor(() => {
            expect(screen.getByName("preset-wobbly", { as: Gtk.Button })).toHaveClass("suggested-action");
            expect(screen.getByName("preset-default", { as: Gtk.Button })).not.toHaveClass("suggested-action");
        });

        const seen = recordMarginWrites(card);
        await clickToggle();
        await expectSettled(card, 0.25, 160);
        expect(Math.max(...seen)).toBeGreaterThan(160);
        await userEvent.click(screen.getByName("preset-stiff", { as: Gtk.Button }));
        await clickToggle();
        await expectSettled(card, 1, 0);
    }, 15_000);
});
