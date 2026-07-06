import * as Adw from "@gtkx/gi/adw";
import * as Gtk from "@gtkx/gi/gtk";
import type { RefObject } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AnimationCssProvider } from "../src/animation-css-provider.js";
import type { AnimationProps } from "../src/types.js";
import { WidgetAnimator } from "../src/widget-animator.js";

const widgetRef = (widget: Gtk.Widget): RefObject<Gtk.Widget | null> => ({ current: widget });
const propsRef = (props: AnimationProps): RefObject<AnimationProps> => ({ current: props });

const makeAnimator = (widget: Gtk.Widget, props: AnimationProps): WidgetAnimator =>
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
        const animator = makeAnimator(widget, { animate: { opacity: 0.3 } });

        animator.applyMount(true);

        expect(writeSpy).toHaveBeenCalledWith({ opacity: 0.3 });
        animator.dispose();
    });

    it("ignores applyMount when no widget is attached", () => {
        const animator = new WidgetAnimator("gtkx-anim-test", { current: null }, propsRef({}));

        expect(() => animator.applyMount(true)).not.toThrow();
        expect(writeSpy).not.toHaveBeenCalled();
        animator.dispose();
    });

    const startDelayedAnimator = (): { animator: WidgetAnimator; playSpy: ReturnType<typeof vi.spyOn> } => {
        vi.useFakeTimers();
        const widget = new Gtk.Box();
        const animator = makeAnimator(widget, {
            animate: { opacity: 1 },
            transition: { duration: 0.1, delay: 0.2 },
        });
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

    it("fires completion callbacks exactly once on a natural completion", () => {
        const onAnimationComplete = vi.fn();
        const onComplete = vi.fn();
        const widget = new Gtk.Box();
        const animator = makeAnimator(widget, { transition: { duration: 0.05 }, onAnimationComplete });

        animator.startAnimation({ opacity: 1 }, onComplete);

        expect(onAnimationComplete).toHaveBeenCalledTimes(1);
        expect(onComplete).toHaveBeenCalledTimes(1);
        animator.dispose();
    });

    it("fires no completion callbacks when disposed during a delay", () => {
        vi.useFakeTimers();
        const onAnimationComplete = vi.fn();
        const onComplete = vi.fn();
        const widget = new Gtk.Box();
        const animator = makeAnimator(widget, {
            transition: { duration: 0.05, delay: 0.2 },
            onAnimationComplete,
        });

        animator.startAnimation({ opacity: 1 }, onComplete);
        animator.dispose();
        vi.advanceTimersByTime(500);

        expect(onAnimationComplete).not.toHaveBeenCalled();
        expect(onComplete).not.toHaveBeenCalled();
    });

    it("suppresses the interrupted animation's completion callbacks", () => {
        vi.useFakeTimers();
        const onAnimationComplete = vi.fn();
        const widget = new Gtk.Box();
        const animator = makeAnimator(widget, {
            transition: { duration: 0.05, delay: 0.2 },
            onAnimationComplete,
        });

        const doneInterrupted = vi.fn();
        const doneSurviving = vi.fn();
        animator.startAnimation({ opacity: 1 }, doneInterrupted);
        animator.startAnimation({ opacity: 0.5 }, doneSurviving);
        vi.advanceTimersByTime(500);

        expect(doneInterrupted).not.toHaveBeenCalled();
        expect(doneSurviving).toHaveBeenCalledTimes(1);
        expect(onAnimationComplete).toHaveBeenCalledTimes(1);
        animator.dispose();
    });
});
