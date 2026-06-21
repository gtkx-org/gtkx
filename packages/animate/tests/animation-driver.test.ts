import * as Adw from "@gtkx/gi/adw";
import * as Gtk from "@gtkx/gi/gtk";
import type { RefObject } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AnimationCssProvider } from "../src/animation-css-provider.js";
import { AnimationDriver, type WidgetAnimationProps } from "../src/use-widget-animation.js";

const widgetRef = (widget: Gtk.Widget): RefObject<Gtk.Widget | null> => ({ current: widget });
const propsRef = (props: WidgetAnimationProps): RefObject<WidgetAnimationProps> => ({ current: props });

const makeDriver = (widget: Gtk.Widget, props: WidgetAnimationProps): AnimationDriver =>
    new AnimationDriver("gtkx-anim-test", widgetRef(widget), propsRef(props));

describe("AnimationDriver", () => {
    let writeSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        writeSpy = vi.spyOn(AnimationCssProvider.prototype, "write");
    });

    afterEach(() => {
        writeSpy.mockRestore();
        vi.useRealTimers();
    });

    it("writes the resolved initial values on applyMount", () => {
        const widget = new Gtk.Box();
        const driver = makeDriver(widget, { kind: "timed", animate: { opacity: 0.3 }, animateOnMount: false });

        driver.applyMount();

        expect(writeSpy).toHaveBeenCalledWith({ opacity: 0.3 });
        driver.dispose();
    });

    it("ignores applyMount when no widget is attached", () => {
        const driver = new AnimationDriver("gtkx-anim-test", { current: null }, propsRef({ kind: "timed" }));

        expect(() => driver.applyMount()).not.toThrow();
        expect(writeSpy).not.toHaveBeenCalled();
        driver.dispose();
    });

    const startDelayedDriver = (): { driver: AnimationDriver; playSpy: ReturnType<typeof vi.spyOn> } => {
        vi.useFakeTimers();
        const widget = new Gtk.Box();
        const driver = makeDriver(widget, { kind: "timed", animate: { opacity: 1 }, duration: 100, delay: 200 });
        const playSpy = vi.spyOn(Adw.Animation.prototype, "play");
        driver.startAnimation({ opacity: 1 });
        return { driver, playSpy };
    };

    it("defers play behind a delay and clears the timer on cancel", () => {
        const { driver, playSpy } = startDelayedDriver();
        expect(playSpy).not.toHaveBeenCalled();

        driver.dispose();
        vi.advanceTimersByTime(500);

        expect(playSpy).not.toHaveBeenCalled();
        playSpy.mockRestore();
    });

    it("plays after the delay elapses without an intervening cancel", () => {
        const { driver, playSpy } = startDelayedDriver();
        vi.advanceTimersByTime(200);

        expect(playSpy).toHaveBeenCalledTimes(1);
        playSpy.mockRestore();
        driver.dispose();
    });
});
