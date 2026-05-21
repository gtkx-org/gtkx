import * as Gtk from "@gtkx/ffi/gtk";
import { act, waitFor } from "@gtkx/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { revealerDemo } from "../../../src/demos/navigation/revealer.js";
import { expectDemoMetadata, renderDemo } from "../../helpers/render-demo.js";

const collectAll = <T extends Gtk.Widget>(
    root: Gtk.Widget,
    predicate: (w: Gtk.Widget) => w is T,
    out: T[] = [],
): T[] => {
    if (predicate(root)) out.push(root);
    let child = root.getFirstChild();
    while (child) {
        collectAll(child, predicate, out);
        child = child.getNextSibling();
    }
    return out;
};

describe("revealerDemo", () => {
    it("exposes the expected metadata", () => {
        expectDemoMetadata(revealerDemo, { id: "revealer", title: "Revealer" });
        expect(typeof revealerDemo.sourceCode).toBe("string");
        expect(revealerDemo.defaultWidth).toBe(300);
        expect(revealerDemo.defaultHeight).toBe(300);
        expect(revealerDemo.keywords).toContain("GtkRevealer");
    });

    it("renders nine GtkRevealer widgets initially hidden", async () => {
        const { container } = await renderDemo(revealerDemo);
        const revealers = collectAll(container, (w): w is Gtk.Revealer => w instanceof Gtk.Revealer);
        expect(revealers).toHaveLength(9);
        for (const r of revealers) {
            expect(r.getRevealChild()).toBe(false);
            expect(r.getTransitionDuration()).toBe(2000);
        }
    });

    it("configures each revealer with the expected transition type", async () => {
        const { container } = await renderDemo(revealerDemo);
        const revealers = collectAll(container, (w): w is Gtk.Revealer => w instanceof Gtk.Revealer);
        const expectedTransitions = [
            Gtk.RevealerTransitionType.CROSSFADE,
            Gtk.RevealerTransitionType.SLIDE_UP,
            Gtk.RevealerTransitionType.SLIDE_RIGHT,
            Gtk.RevealerTransitionType.SLIDE_DOWN,
            Gtk.RevealerTransitionType.SLIDE_LEFT,
            Gtk.RevealerTransitionType.SLIDE_UP,
            Gtk.RevealerTransitionType.SLIDE_RIGHT,
            Gtk.RevealerTransitionType.SLIDE_DOWN,
            Gtk.RevealerTransitionType.SLIDE_LEFT,
        ];
        revealers.forEach((r, i) => {
            expect(r.getTransitionType()).toBe(expectedTransitions[i]);
        });
    });

    it("places each revealer's child as a GtkImage with the cool-face icon", async () => {
        const { container } = await renderDemo(revealerDemo);
        const revealers = collectAll(container, (w): w is Gtk.Revealer => w instanceof Gtk.Revealer);
        for (const r of revealers) {
            const child = r.getChild() as Gtk.Image;
            expect(child).toBeInstanceOf(Gtk.Image);
            expect(child.getIconName()).toBe("face-cool-symbolic");
        }
    });

    it("renders the GtkGrid container with center alignment", async () => {
        const { container } = await renderDemo(revealerDemo);
        const grid = collectAll(container, (w): w is Gtk.Grid => w instanceof Gtk.Grid)[0];
        expect(grid).toBeInstanceOf(Gtk.Grid);
        expect(grid?.getHalign()).toBe(Gtk.Align.CENTER);
        expect(grid?.getValign()).toBe(Gtk.Align.CENTER);
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
        const { container } = await renderDemo(revealerDemo);
        const revealers = collectAll(container, (w): w is Gtk.Revealer => w instanceof Gtk.Revealer);
        await act(async () => {
            await vi.advanceTimersByTimeAsync(690 * 9);
        });
        await waitFor(() => {
            expect(revealers.every((r) => r.getRevealChild())).toBe(true);
        });
    });
});
