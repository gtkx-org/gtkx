import { describe, expect, it } from "vitest";
import { scaleDemo } from "../../../src/demos/buttons/scale.js";
import { renderDemo, screen } from "../../test-utils.js";

describe("scaleDemo", () => {
    it("exposes the expected metadata", () => {
        expect(scaleDemo.id).toBe("scale");
        expect(scaleDemo.title).toBe("Scales");
        expect(typeof scaleDemo.sourceCode).toBe("string");
    });

    it("renders the grid containing the three scale rows", async () => {
        const { container } = await renderDemo(scaleDemo);
        expect(container).toBeDefined();
        const text = await screen.findByText("Plain", { exact: false });
        expect(text).toBeDefined();
    });
});
