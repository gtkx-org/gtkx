import { describe, expect, it } from "vitest";
import { gtkxFastRefresh } from "../../../src/vite-plugins/fast-refresh/index.js";

describe("gtkxFastRefresh", () => {
    it("returns the swc transform and refresh-runtime plugins in enforce order", () => {
        const plugins = gtkxFastRefresh();

        expect(plugins).toHaveLength(2);
        expect(plugins.map((plugin) => plugin.name)).toEqual(["gtkx:swc-refresh", "gtkx:refresh-runtime"]);
        expect(plugins.map((plugin) => plugin.enforce)).toEqual(["pre", "post"]);
    });
});
