import { describe, expect, it } from "vitest";
import { gtkxFastRefresh } from "../../../src/vite-plugins/fast-refresh/index.js";

describe("gtkxFastRefresh", () => {
    it("returns the transform and header plugins in enforce order", () => {
        const plugins = gtkxFastRefresh();

        expect(plugins).toHaveLength(2);
        expect(plugins.map((plugin) => plugin.name)).toEqual(["gtkx:swc-ssr-refresh", "gtkx:refresh"]);
        expect(plugins.map((plugin) => plugin.enforce)).toEqual(["pre", "post"]);
    });

    it("forwards filter options to both plugins", () => {
        const pair = gtkxFastRefresh({ include: /\.custom$/ });
        expect(pair).toHaveLength(2);
    });
});
