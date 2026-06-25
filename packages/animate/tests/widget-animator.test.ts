import * as Adw from "@gtkx/gi/adw";
import * as Gtk from "@gtkx/gi/gtk";
import type { RefObject } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AnimationCssProvider } from "../src/animation-css-provider.js";
import { type WidgetAnimationProps, WidgetAnimator } from "../src/use-widget-animation.js";

const widgetRef = (widget: Gtk.Widget): RefObject<Gtk.Widget | null> => ({ current: widget });
const propsRef = (props: WidgetAnimationProps): RefObject<WidgetAnimationProps> => ({ current: props });

const makeAnimator = (widget: Gtk.Widget, props: WidgetAnimationProps): WidgetAnimator =>
    new WidgetAnimator("gtkx-anim-test", widgetRef(widget), propsRef(props));

describe("WidgetAnimator", () => {
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
        const animator = makeAnimator(widget, { type: "timed", animate: { opacity: 0.3 }, animateOnMount: false });

        animator.applyMount();

        expect(writeSpy).toHaveBeenCalledWith({ opacity: 0.3 });
        animator.dispose();
    });

    it("ignores applyMount when no widget is attached", () => {
        const animator = new WidgetAnimator("gtkx-anim-test", { current: null }, propsRef({ type: "timed" }));

        expect(() => animator.applyMount()).not.toThrow();
        expect(writeSpy).not.toHaveBeenCalled();
        animator.dispose();
    });

    const startDelayedAnimator = (): { animator: WidgetAnimator; playSpy: ReturnType<typeof vi.spyOn> } => {
        vi.useFakeTimers();
        const widget = new Gtk.Box();
        const animator = makeAnimator(widget, { type: "timed", animate: { opacity: 1 }, duration: 100, delay: 200 });
        const playSpy = vi.spyOn(Adw.Animation.prototype, "play");
        animator.startAnimation({ opacity: 1 });
        return { animator, playSpy };
    };

    it("defers play behind a delay and clears the timer on cancel", () => {
        const { animator, playSpy } = startDelayedAnimator();
        expect(playSpy).not.toHaveBeenCalled();

        animator.dispose();
        vi.advanceTimersByTime(500);

        expect(playSpy).not.toHaveBeenCalled();
        playSpy.mockRestore();
    });

    it("plays after the delay elapses without an intervening cancel", () => {
        const { animator, playSpy } = startDelayedAnimator();
        vi.advanceTimersByTime(200);

        expect(playSpy).toHaveBeenCalledTimes(1);
        playSpy.mockRestore();
        animator.dispose();
    });
});
