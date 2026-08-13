import { css, cx, injectGlobal } from "@gtkx/css";
import * as Gtk from "@gtkx/gi/gtk";
import { describe, expect, it } from "vitest";
import { probeColor, probeMinWidth, probeStyle } from "./helpers/probe.js";

const RED = [1, 0, 0];
const GREEN = [0, 1, 0];
const BLUE = [0, 0, 1];

describe("css", () => {
    it("styles a widget through the class it returns", async () => {
        const className = css`
            color: rgb(255, 0, 0);
            min-width: 137px;
        `;

        expect(className).toMatch(/^gtkx-/);
        const style = await probeStyle({ classNames: [className] });
        expect(style.color).toEqual(RED);
        expect(style.minWidth).toBeGreaterThanOrEqual(137);
    });

    it("returns one class per set of styles", async () => {
        const first = css({ color: "rgb(0, 0, 255)", minWidth: "141px" });
        const same = css({ color: "rgb(0, 0, 255)", minWidth: "141px" });
        const other = css({ color: "rgb(0, 255, 0)", minWidth: "142px" });
        expect(same).toBe(first);
        expect(other).not.toBe(first);
        expect(await probeColor([first])).toEqual(BLUE);
        expect(await probeColor([other])).toEqual(GREEN);
    });
});

describe("css selectors and at-rules", () => {
    it("applies a nested selector once the widget enters that state", async () => {
        const className = css`
            color: rgb(255, 0, 0);

            &:hover {
                color: rgb(0, 255, 0);
            }
        `;

        expect(await probeColor([className])).toEqual(RED);
        const prelit = await probeStyle({ classNames: [className], stateFlags: Gtk.StateFlags.PRELIGHT });
        expect(prelit.color).toEqual(GREEN);
    });

    it("keeps GTK named colors and at-rules intact", async () => {
        const className = css`
            color: alpha(@theme_fg_color, 0.4);
            min-width: 143px;

            @keyframes gtkx-css-test-spin {
                to {
                    min-width: 999px;
                }
            }
        `;

        const style = await probeStyle({ classNames: [className] });
        expect(style.alpha).toBeCloseTo(0.4, 2);
        expect(style.minWidth).toBeGreaterThanOrEqual(143);
    });
});

describe("css composition", () => {
    it("inlines a class interpolated into another set of styles", async () => {
        const base = css({ color: "rgb(0, 0, 255)" });

        const composed = css`
            ${base}
            min-width: 147px;
        `;

        const style = await probeStyle({ classNames: [composed] });
        expect(style.color).toEqual(BLUE);
        expect(style.minWidth).toBeGreaterThanOrEqual(147);
    });

    it("strips the label declaration Emotion adds", async () => {
        const className = css({ label: "probe", color: "rgb(0, 255, 0)", minWidth: "149px" });
        const style = await probeStyle({ classNames: [className] });
        expect(style.color).toEqual(GREEN);
        expect(style.minWidth).toBeGreaterThanOrEqual(149);
    });
});

describe("cx", () => {
    it("merges generated classes into one where the later styles win", async () => {
        const first = css({ color: "rgb(255, 0, 0)", minWidth: "151px" });
        const second = css({ color: "rgb(0, 0, 255)" });
        const merged = cx(first, second);
        expect(merged).toHaveLength(1);
        expect(merged).not.toContain(first);
        const style = await probeStyle({ classNames: merged });
        expect(style.color).toEqual(BLUE);
        expect(style.minWidth).toBeGreaterThanOrEqual(151);
    });

    it("merges styles whose last declaration omits its semicolon", async () => {
        const first = css("min-width: 153px");
        const second = css("color: rgb(0, 0, 255)");
        const style = await probeStyle({ classNames: cx(first, second) });
        expect(style.color).toEqual(BLUE);
        expect(style.minWidth).toBeGreaterThanOrEqual(153);
    });

    it("merges nested and at-rule bodies alongside a plain declaration", async () => {
        const plain = css("min-width: 157px");

        const nested = css`
            &:hover {
                color: rgb(0, 255, 0);
            }
        `;

        const merged = cx(plain, nested);
        const resting = await probeStyle({ classNames: merged });
        expect(resting.minWidth).toBeGreaterThanOrEqual(157);
        const prelit = await probeStyle({ classNames: merged, stateFlags: Gtk.StateFlags.PRELIGHT });
        expect(prelit.color).toEqual(GREEN);
    });

    it("passes plain class names through and drops the falsy tokens", () => {
        expect(cx("a", "b", "c")).toEqual(["a", "b", "c"]);
        expect(cx("base", false, undefined, null, "")).toEqual(["base"]);
        expect(cx()).toEqual([]);
    });
});

describe("injectGlobal", () => {
    it("styles a widget through an unscoped selector", async () => {
        injectGlobal(`
            label.gtkx-global-probe {
                color: rgb(0, 0, 255);
                min-width: 159px;
            }
        `);

        const style = await probeStyle({ classNames: ["gtkx-global-probe"] });
        expect(style.color).toEqual(BLUE);
        expect(style.minWidth).toBeGreaterThanOrEqual(159);
    });

    it("keeps the styles in place when the same declarations are injected twice", async () => {
        injectGlobal({ "label.gtkx-global-twice": { minWidth: "161px" } });
        injectGlobal({ "label.gtkx-global-twice": { minWidth: "161px" } });
        expect(await probeMinWidth(["gtkx-global-twice"])).toBeGreaterThanOrEqual(161);
    });
});
