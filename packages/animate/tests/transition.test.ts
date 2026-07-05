import * as Adw from "@gtkx/gi/adw";
import * as Gtk from "@gtkx/gi/gtk";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildAnimation } from "../src/transition.js";

const makeTarget = (): Adw.AnimationTarget => Adw.CallbackAnimationTarget.new(() => {});

describe("buildAnimation", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("maps an infinite duration to DURATION_INFINITE", () => {
        const newSpy = vi.spyOn(Adw.TimedAnimation, "new");
        const widget = new Gtk.Box();

        buildAnimation(widget, makeTarget(), { type: "tween", duration: Number.POSITIVE_INFINITY });

        expect(newSpy.mock.calls[0]?.[3]).toBe(Adw.DURATION_INFINITE);
    });

    it("maps a finite repeat to Adw repeat count plus one", () => {
        const repeatSpy = vi.spyOn(Adw.TimedAnimation.prototype, "setRepeatCount");
        const widget = new Gtk.Box();

        buildAnimation(widget, makeTarget(), { type: "tween", duration: 0.1, repeat: 2 });

        expect(repeatSpy).toHaveBeenCalledWith(3);
    });

    it("alternates for reverse and mirror repeat types but not loop", () => {
        const alternateSpy = vi.spyOn(Adw.TimedAnimation.prototype, "setAlternate");
        const widget = new Gtk.Box();

        buildAnimation(widget, makeTarget(), { type: "tween", duration: 0.1, repeatType: "reverse" });
        buildAnimation(widget, makeTarget(), { type: "tween", duration: 0.1, repeatType: "mirror" });
        buildAnimation(widget, makeTarget(), { type: "tween", duration: 0.1, repeatType: "loop" });

        expect(alternateSpy).toHaveBeenNthCalledWith(1, true);
        expect(alternateSpy).toHaveBeenNthCalledWith(2, true);
        expect(alternateSpy).toHaveBeenNthCalledWith(3, false);
    });

    it("builds a spring animation and forwards epsilon", () => {
        const springSpy = vi.spyOn(Adw.SpringAnimation, "new");
        const epsilonSpy = vi.spyOn(Adw.SpringAnimation.prototype, "setEpsilon");
        const widget = new Gtk.Box();

        buildAnimation(widget, makeTarget(), { type: "spring", epsilon: 0.01 });

        expect(springSpy).toHaveBeenCalledTimes(1);
        expect(epsilonSpy).toHaveBeenCalledWith(0.01);
    });
});
