import * as Gtk from "@gtkx/gi/gtk";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AnimationCssProvider } from "../src/animation-css-provider.js";

const drain = (): Promise<void> => Promise.resolve();

describe("AnimationCssProvider", () => {
    afterEach(async () => {
        await drain();
        vi.restoreAllMocks();
    });

    it("adds the css class once across repeated attach calls", () => {
        const widget = new Gtk.Box();
        const addSpy = vi.spyOn(widget, "addCssClass");
        const provider = new AnimationCssProvider("gtkx-anim-attach");

        provider.attach(widget);
        provider.attach(widget);

        expect(addSpy).toHaveBeenCalledTimes(1);
        provider.dispose();
    });

    it("removes the css class on dispose and tolerates a second dispose", () => {
        const widget = new Gtk.Box();
        const removeSpy = vi.spyOn(widget, "removeCssClass");
        const provider = new AnimationCssProvider("gtkx-anim-dispose");

        provider.attach(widget);
        provider.dispose();
        provider.dispose();

        expect(removeSpy).toHaveBeenCalledTimes(1);
    });

    it("does not touch the provider when writing before attach", async () => {
        await drain();
        const loadSpy = vi.spyOn(Gtk.CssProvider.prototype, "loadFromString");
        const provider = new AnimationCssProvider("gtkx-anim-detached");

        provider.write({ opacity: 0.5 });
        await drain();

        expect(loadSpy).not.toHaveBeenCalled();
    });

    it("coalesces to one flush and dedups identical writes", async () => {
        const widget = new Gtk.Box();
        const provider = new AnimationCssProvider("gtkx-anim-flush");
        provider.attach(widget);
        await drain();

        const loadSpy = vi.spyOn(Gtk.CssProvider.prototype, "loadFromString");

        provider.write({ opacity: 0.5 });
        provider.write({ opacity: 0.5 });
        await drain();

        expect(loadSpy).toHaveBeenCalledTimes(1);
        expect(String(loadSpy.mock.calls[0]?.[0])).toContain("gtkx-anim-flush");

        provider.write({ opacity: 0.5 });
        await drain();
        expect(loadSpy).toHaveBeenCalledTimes(1);

        provider.dispose();
        await drain();
    });
});
