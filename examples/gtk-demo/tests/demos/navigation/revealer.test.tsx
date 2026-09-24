import * as Gtk from "@gtkx/gi/gtk";
import { act, screen, waitFor } from "@gtkx/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { revealerDemo } from "../../../src/demos/navigation/revealer.js";
import { renderDemo } from "../../test-utils.js";

const REVEALER_COUNT = 9;
const REVEAL_INTERVAL_MS = 690;

const findAllRevealers = async (): Promise<Gtk.Revealer[]> => {
    const revealers: Gtk.Revealer[] = [];

    for (let i = 0; i < REVEALER_COUNT; i++) {
        revealers.push(await screen.findByName(`revealer-${String(i)}`, { as: Gtk.Revealer }));
    }

    return revealers;
};

describe("revealerDemo structure", () => {
    it("renders nine initially hidden revealers as one named animation", async () => {
        await renderDemo(revealerDemo);
        const grid = await screen.findByRole(Gtk.AccessibleRole.IMG, {
            name: "Animated cool faces",
            as: Gtk.Grid,
        });
        const revealers = await findAllRevealers();
        expect(revealers).toHaveLength(REVEALER_COUNT);
        expect(revealers.every((revealer) => !revealer.getRevealChild())).toBe(true);
        expect(grid).toBeVisible();
    });
});

describe("revealerDemo reveal sequence", () => {
    beforeEach(() => {
        vi.useFakeTimers({ shouldAdvanceTime: true });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("shows the decorative cool-face icons once they are revealed", async () => {
        await renderDemo(revealerDemo);
        expect(screen.queryAllByRole(Gtk.AccessibleRole.PRESENTATION)).toHaveLength(0);

        await act(async () => {
            await vi.advanceTimersByTimeAsync(REVEAL_INTERVAL_MS * REVEALER_COUNT);
        });

        const images = await screen.findAllByRole(Gtk.AccessibleRole.PRESENTATION, { as: Gtk.Image });
        expect(images).toHaveLength(REVEALER_COUNT);
        const iconNames = images.map((image) => image.getIconName());
        expect(iconNames.every((name) => name === "face-cool-symbolic")).toBe(true);
    });

    it("reveals the cells in order", async () => {
        await renderDemo(revealerDemo);
        const revealers = await findAllRevealers();
        const first = await screen.findByName("revealer-0", { as: Gtk.Revealer });
        const second = await screen.findByName("revealer-1", { as: Gtk.Revealer });

        await act(async () => {
            await vi.advanceTimersByTimeAsync(REVEAL_INTERVAL_MS);
        });

        expect(first.getRevealChild()).toBe(true);
        expect(second.getRevealChild()).toBe(false);

        await act(async () => {
            await vi.advanceTimersByTimeAsync(REVEAL_INTERVAL_MS * (REVEALER_COUNT - 1));
        });

        await waitFor(() => {
            expect(revealers.every((r) => r.getRevealChild())).toBe(true);
        });
    });
});

describe("revealerDemo pulse", () => {
    it("hides an animated revealer again once its transition finishes", async () => {
        await renderDemo(revealerDemo, { areAnimationsEnabled: true });
        const first = await screen.findByName("revealer-0", { as: Gtk.Revealer });

        await waitFor(() => {
            expect(first.getRevealChild()).toBe(true);
        });

        await waitFor(() => {
            expect(first.getRevealChild()).toBe(false);
        });
    });

    it("leaves a revealer shown when its transition is instant", async () => {
        await renderDemo(revealerDemo);
        const instant = await screen.findByName("revealer-3", { as: Gtk.Revealer });

        await waitFor(() => {
            expect(instant.getRevealChild()).toBe(true);
        });

        expect(instant.getChildRevealed()).toBe(true);
    });
});
