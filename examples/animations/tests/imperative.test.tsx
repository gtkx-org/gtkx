import * as Gtk from "@gtkx/gi/gtk";
import { render, screen, userEvent, waitFor } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { imperativeDemo } from "../src/demos/imperative.js";

const { component: ImperativeDemo } = imperativeDemo;
const ANIMATED = { areAnimationsEnabled: true };

const findLevel = async (): Promise<Gtk.LevelBar> =>
    await screen.findByName("imperative-level", { as: Gtk.LevelBar });

const clickButton = async (name: string): Promise<void> => {
    await userEvent.click(screen.getByName(name, { as: Gtk.Button }));
};

const delay = (ms: number): Promise<void> =>
    new Promise((resolve) => {
        setTimeout(resolve, ms);
    });

const expectValue = (level: Gtk.LevelBar, value: number): Promise<void> =>
    waitFor(() => {
        expect(level).toHaveObjectProperty("value", value);
    });

const expectInFlight = (level: Gtk.LevelBar): Promise<void> =>
    waitFor(() => {
        const value = level.getValue();
        expect(value).toBeGreaterThan(0);
        expect(value).toBeLessThan(100);
    });

describe("imperative demo", () => {
    it("animates the level bar and the percent label to the target", async () => {
        await render(<ImperativeDemo />, ANIMATED);
        const level = await findLevel();
        expect(level).toHaveObjectProperty("value", 0);
        expect(await screen.findByText("0%")).toBeVisible();
        await clickButton("imperative-start");
        await expectInFlight(level);
        await expectValue(level, 100);
        expect(await screen.findByText("100%")).toBeVisible();
    }, 15_000);

    it("holds the value while paused and finishes after resume", async () => {
        await render(<ImperativeDemo />, ANIMATED);
        const level = await findLevel();
        await clickButton("imperative-start");
        await expectInFlight(level);
        await clickButton("imperative-pause");
        const paused = level.getValue();
        expect(paused).toBeLessThan(100);
        await delay(200);
        expect(level.getValue()).toBe(paused);
        await clickButton("imperative-resume");
        await expectValue(level, 100);
        expect(await screen.findByText("100%")).toBeVisible();
    }, 15_000);

    it("resets to zero mid-flight and starts over", async () => {
        await render(<ImperativeDemo />, ANIMATED);
        const level = await findLevel();
        await clickButton("imperative-start");
        await expectInFlight(level);
        await clickButton("imperative-reset");
        await expectValue(level, 0);
        expect(await screen.findByText("0%")).toBeVisible();
        await clickButton("imperative-start");
        await expectValue(level, 100);
    }, 15_000);

    it("settles at the target when start is pressed again mid-flight", async () => {
        await render(<ImperativeDemo />, ANIMATED);
        const level = await findLevel();
        await clickButton("imperative-start");
        await expectInFlight(level);
        await clickButton("imperative-start");
        await expectValue(level, 100);
    }, 15_000);
});
