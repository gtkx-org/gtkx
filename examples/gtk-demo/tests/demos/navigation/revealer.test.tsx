import * as Gtk from "@gtkx/gi/gtk";
import { act, screen, waitFor } from "@gtkx/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { revealerDemo } from "../../../src/demos/navigation/revealer.js";
import { renderDemo } from "../../test-utils.js";

const REVEALER_COUNT = 9;

const REVEALER_CELLS: Array<{ column: number; row: number }> = [
    { column: 2, row: 2 },
    { column: 2, row: 1 },
    { column: 3, row: 2 },
    { column: 2, row: 3 },
    { column: 1, row: 2 },
    { column: 2, row: 0 },
    { column: 4, row: 2 },
    { column: 2, row: 4 },
    { column: 0, row: 2 },
];

const findAllRevealers = async (): Promise<Gtk.Revealer[]> => {
    const revealers: Gtk.Revealer[] = [];
    for (let i = 0; i < REVEALER_COUNT; i++) {
        revealers.push((await screen.findByName(`revealer-${i}`)) as Gtk.Revealer);
    }
    return revealers;
};

const collectGridRevealers = (grid: Gtk.Grid): Gtk.Revealer[] => {
    const revealers: Gtk.Revealer[] = [];
    for (let child = grid.getFirstChild(); child; child = child.getNextSibling()) {
        if (child instanceof Gtk.Revealer) revealers.push(child);
    }
    return revealers;
};

describe("revealerDemo metadata", () => {
    it("exposes the expected metadata", () => {
        expect(revealerDemo.id).toBe("revealer");
        expect(revealerDemo.title).toBe("Revealer");
        expect(revealerDemo.description).toContain("GtkRevealer");
        expect(typeof revealerDemo.sourceCode).toBe("string");
        expect(revealerDemo.defaultWidth).toBe(300);
        expect(revealerDemo.defaultHeight).toBe(300);
        expect(Array.isArray(revealerDemo.keywords)).toBe(true);
    });
});

describe("revealerDemo structure", () => {
    it("renders exactly nine GtkRevealer widgets initially hidden", async () => {
        await renderDemo(revealerDemo);
        const grid = (await screen.findByName("revealer-grid")) as Gtk.Grid;
        const revealers = collectGridRevealers(grid);
        expect(revealers).toHaveLength(REVEALER_COUNT);
        for (const r of revealers) {
            expect(r.getRevealChild()).toBe(false);
            expect(r.getTransitionDuration()).toBe(2000);
        }
    });

    it("configures each revealer with the expected transition type", async () => {
        await renderDemo(revealerDemo);
        const revealers = await findAllRevealers();
        const expectedTransitions = [
            Gtk.RevealerTransitionType.CROSSFADE,
            Gtk.RevealerTransitionType.SLIDE_UP,
            Gtk.RevealerTransitionType.SLIDE_RIGHT,
            Gtk.RevealerTransitionType.NONE,
            Gtk.RevealerTransitionType.SLIDE_LEFT,
            Gtk.RevealerTransitionType.SLIDE_UP,
            Gtk.RevealerTransitionType.SLIDE_RIGHT,
            Gtk.RevealerTransitionType.NONE,
            Gtk.RevealerTransitionType.SLIDE_LEFT,
        ];
        revealers.forEach((r, i) => {
            expect(r.getTransitionType()).toBe(expectedTransitions[i]);
        });
    });

    it("places each revealer's child as a GtkImage with the cool-face icon", async () => {
        await renderDemo(revealerDemo);
        const images = await screen.findAllByRole(Gtk.AccessibleRole.IMG);
        expect(images).toHaveLength(REVEALER_COUNT);
        for (const image of images) {
            expect(image).toBeInstanceOf(Gtk.Image);
            expect((image as Gtk.Image).getIconName()).toBe("face-cool-symbolic");
        }
    });

    it("places each revealer at its configured grid cell forming the cross layout", async () => {
        await renderDemo(revealerDemo);
        const grid = (await screen.findByName("revealer-grid")) as Gtk.Grid;
        const revealers = await findAllRevealers();
        REVEALER_CELLS.forEach((cell, index) => {
            expect(grid.getChildAt(cell.column, cell.row)).toBe(revealers[index]);
        });
    });
});

describe("revealerDemo reveal sequence", () => {
    beforeEach(() => {
        vi.useFakeTimers({ shouldAdvanceTime: true });
    });
    afterEach(() => {
        vi.useRealTimers();
    });

    it("reveals every revealer after nine timer ticks", async () => {
        await renderDemo(revealerDemo);
        const revealers = await findAllRevealers();
        await act(async () => {
            await vi.advanceTimersByTimeAsync(690 * 9);
        });
        await waitFor(() => {
            expect(revealers.every((r) => r.getRevealChild())).toBe(true);
        });
    });
});
