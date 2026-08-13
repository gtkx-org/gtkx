import * as Gtk from "@gtkx/gi/gtk";
import { act, screen, waitFor } from "@gtkx/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { revealerDemo } from "../../../src/demos/navigation/revealer.js";
import { collectWidgets, renderDemo } from "../../test-utils.js";

const REVEALER_COUNT = 9;

const REVEALER_CELLS: { column: number; row: number }[] = [
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

const EXPECTED_TRANSITIONS = [
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

const findAllRevealers = async (): Promise<Gtk.Revealer[]> => {
    const revealers: Gtk.Revealer[] = [];

    for (let i = 0; i < REVEALER_COUNT; i++) {
        revealers.push(await screen.findByName(`revealer-${String(i)}`, { as: Gtk.Revealer }));
    }

    return revealers;
};

describe("revealerDemo metadata", () => {
    it("exposes the expected metadata", () => {
        expect(revealerDemo.id).toBe("revealer");
        expect(revealerDemo.title).toBe("Revealer");
        expect(revealerDemo.description).toContain("GtkRevealer");
        expect(revealerDemo.sourceCode).toContain("const revealerDemo: Demo = {");
        expect(revealerDemo.defaultWidth).toBe(300);
        expect(revealerDemo.defaultHeight).toBe(300);
        expect(revealerDemo.keywords).toEqual([]);
    });
});

describe("revealerDemo structure", () => {
    it("renders exactly nine GtkRevealer widgets initially hidden", async () => {
        await renderDemo(revealerDemo);
        const grid = await screen.findByName("revealer-grid", { as: Gtk.Grid });
        const revealers = collectWidgets(grid, Gtk.Revealer);
        expect(revealers).toHaveLength(REVEALER_COUNT);
        expect(revealers.some((revealer) => revealer.getRevealChild())).toBe(false);
        expect(revealers.every((revealer) => revealer.getTransitionDuration() === 2000)).toBe(true);
    });

    it("configures each revealer with the expected transition type", async () => {
        await renderDemo(revealerDemo);
        const revealers = await findAllRevealers();
        expect(revealers.map((revealer) => revealer.getTransitionType())).toEqual(EXPECTED_TRANSITIONS);
    });

    it("places each revealer at its configured grid cell forming the cross layout", async () => {
        await renderDemo(revealerDemo);
        const grid = await screen.findByName("revealer-grid", { as: Gtk.Grid });
        const revealers = await findAllRevealers();
        const placed = REVEALER_CELLS.map((cell) => grid.getChildAt(cell.column, cell.row));
        expect(placed).toEqual(revealers);
    });
});

describe("revealerDemo reveal sequence", () => {
    beforeEach(() => {
        vi.useFakeTimers({ shouldAdvanceTime: true });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("shows each revealer's child as a GtkImage with the cool-face icon once it is revealed", async () => {
        await renderDemo(revealerDemo);
        expect(screen.queryAllByRole(Gtk.AccessibleRole.IMG)).toHaveLength(0);

        await act(async () => {
            await vi.advanceTimersByTimeAsync(690 * 9);
        });

        const images = await screen.findAllByRole(Gtk.AccessibleRole.IMG, { as: Gtk.Image });
        expect(images).toHaveLength(REVEALER_COUNT);
        expect(images.every((image) => image instanceof Gtk.Image)).toBe(true);
        const iconNames = images.map((image) => image.getIconName());
        expect(iconNames.every((name) => name === "face-cool-symbolic")).toBe(true);
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
