import type * as Gtk from "@gtkx/gi/gtk";
import { render, screen, userEvent, waitFor } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { chainDemo } from "../src/demos/chain.js";

const ANIMATED = { areAnimationsEnabled: true };
const ITEMS = ["Espresso", "Cappuccino", "Latte", "Mocha"];
const ChainComponent = chainDemo.component;

const panel = (): Gtk.Widget => screen.getByName("chain-panel");

const expectShown = (): Promise<void> =>
    waitFor(() => {
        expect(panel().getOpacity()).toBeCloseTo(1, 2);

        for (const item of ITEMS) {
            const label = screen.getByText(item);
            expect(label.getOpacity()).toBeCloseTo(1, 2);
            expect(label).toHaveObjectProperty("marginStart", 12);
        }
    });

const expectHidden = (): Promise<void> =>
    waitFor(() => {
        expect(panel().getOpacity()).toBeCloseTo(0, 2);

        for (const item of ITEMS) {
            const label = screen.getByText(item);
            expect(label.getOpacity()).toBeCloseTo(0, 2);
            expect(label).toHaveObjectProperty("marginStart", 36);
        }
    });

describe("chain demo", () => {
    it("settles the panel and every item fully shown after the opening sequence", async () => {
        await render(<ChainComponent />, ANIMATED);
        await expectShown();
    });

    it("reverses out through the toggle and comes back on toggling again", async () => {
        await render(<ChainComponent />, ANIMATED);
        await expectShown();
        await userEvent.click(screen.getByName("chain-toggle"));
        await expectHidden();
        await userEvent.click(screen.getByName("chain-toggle"));
        await expectShown();
    });

    it("replays the opening sequence from its start", async () => {
        await render(<ChainComponent />, ANIMATED);
        await expectShown();
        await userEvent.click(screen.getByName("chain-replay"));

        await waitFor(() => {
            expect(panel().getOpacity()).toBeLessThan(1);
        });

        await expectShown();
    });

    it("replays the closing sequence from its start", async () => {
        await render(<ChainComponent />, ANIMATED);
        await expectShown();
        await userEvent.click(screen.getByName("chain-toggle"));
        await expectHidden();
        await userEvent.click(screen.getByName("chain-replay"));

        await waitFor(() => {
            expect(panel().getOpacity()).toBeGreaterThan(0);
        });

        await expectHidden();
    });

    it("settles hidden when toggled off while the opening run is in flight", async () => {
        await render(<ChainComponent />, ANIMATED);
        await expectShown();
        await userEvent.click(screen.getByName("chain-replay"));

        await waitFor(() => {
            const opacity = panel().getOpacity();
            expect(opacity).toBeGreaterThan(0);
            expect(opacity).toBeLessThan(1);
        });

        await userEvent.click(screen.getByName("chain-toggle"));
        await expectHidden();
    });
});
