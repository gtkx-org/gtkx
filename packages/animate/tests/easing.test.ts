import * as Adw from "@gtkx/gi/adw";
import { describe, expect, it } from "vitest";
import { resolveEasing } from "../src/easing.js";

describe("resolveEasing", () => {
    it("maps a named easing to its Adw enum value", () => {
        expect(resolveEasing("easeInOut")).toBe(Adw.Easing.EASE_IN_OUT);
        expect(resolveEasing("linear")).toBe(Adw.Easing.LINEAR);
    });

    it("maps aliases to the same enum as their canonical name", () => {
        expect(resolveEasing("circIn")).toBe(resolveEasing("easeInCirc"));
        expect(resolveEasing("circOut")).toBe(resolveEasing("easeOutCirc"));
        expect(resolveEasing("backInOut")).toBe(resolveEasing("easeInOutBack"));
    });

    it("passes a numeric Adw easing through unchanged", () => {
        expect(resolveEasing(Adw.Easing.EASE_OUT_BOUNCE)).toBe(Adw.Easing.EASE_OUT_BOUNCE);
    });
});
