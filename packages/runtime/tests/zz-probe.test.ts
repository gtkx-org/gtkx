import * as Gtk from "@gtkx/gi/gtk";
import { describe, expect, it } from "vitest";

describe("probes", () => {
    it("evaluates into an inferred value", () => {
        const expression = Gtk.ConstantExpression.newForValue("payload");
        const result = expression.evaluate(null, "scratch");
        console.log("evaluate returned", result);
        expect(result).toBe(true);
    });
});
