import { screen } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { scaleDemo } from "../../../src/demos/buttons/scale.js";
import { renderDemo } from "../../helpers/render-demo.js";

describe("scaleDemo", () => {
    it("exposes the expected metadata", () => {
        expect(scaleDemo.id).toBe("scale");
        expect(scaleDemo.title).toBe("Scales");
        expect(typeof scaleDemo.sourceCode).toBe("string");
    });

    it("renders the grid containing the three scale rows", async () => {
        if (!scaleDemo.component) throw new Error("scale demo component missing");
        const { container } = await renderDemo(scaleDemo.component);
        expect(container).toBeDefined();
        const text = await screen.findByText("Plain", { exact: false });
        expect(text).toBeDefined();
    });
});
