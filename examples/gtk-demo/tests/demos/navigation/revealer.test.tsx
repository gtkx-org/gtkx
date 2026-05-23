import * as Gtk from "@gtkx/ffi/gtk";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { revealerDemo } from "../../../src/demos/navigation/revealer.js";
import { act, renderDemo, screen, waitFor } from "../../test-utils.js";

const REVEALER_COUNT = 9;

const collectRevealers = async (): Promise<Gtk.Revealer[]> => {
    const images = await screen.findAllByRole(Gtk.AccessibleRole.IMG);
    return images.map((image) => {
        const parent = image.getParent();
        if (!(parent instanceof Gtk.Revealer)) throw new Error("expected image parent to be a Revealer");
        return parent;
    });
};

describe("revealerDemo metadata", () => {
    it("exposes the expected metadata", () => {
        expect(revealerDemo.id).toBe("revealer");
        expect(revealerDemo.title).toBe("Revealer");
        expect(revealerDemo.description.length).toBeGreaterThan(0);
        expect(typeof revealerDemo.sourceCode).toBe("string");
        expect(revealerDemo.defaultWidth).toBe(300);
        expect(revealerDemo.defaultHeight).toBe(300);
        expect(Array.isArray(revealerDemo.keywords)).toBe(true);
    });
});

describe("revealerDemo structure", () => {
    it("renders nine GtkRevealer widgets initially hidden", async () => {
        await renderDemo(revealerDemo);
        const revealers = await collectRevealers();
        expect(revealers).toHaveLength(REVEALER_COUNT);
        for (const r of revealers) {
            expect(r.getRevealChild()).toBe(false);
            expect(r.getTransitionDuration()).toBe(2000);
        }
    });

    it("configures each revealer with the expected transition type", async () => {
        await renderDemo(revealerDemo);
        const revealers = await collectRevealers();
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

    it("renders the GtkGrid container with center alignment", async () => {
        await renderDemo(revealerDemo);
        const revealers = await collectRevealers();
        const firstRevealer = revealers[0];
        if (!firstRevealer) throw new Error("expected at least one revealer");
        const grid = firstRevealer.getParent();
        expect(grid).toBeInstanceOf(Gtk.Grid);
        expect((grid as Gtk.Grid).getHalign()).toBe(Gtk.Align.CENTER);
        expect((grid as Gtk.Grid).getValign()).toBe(Gtk.Align.CENTER);
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
        const revealers = await collectRevealers();
        await act(async () => {
            await vi.advanceTimersByTimeAsync(690 * 9);
        });
        await waitFor(() => {
            expect(revealers.every((r) => r.getRevealChild())).toBe(true);
        });
    });
});
