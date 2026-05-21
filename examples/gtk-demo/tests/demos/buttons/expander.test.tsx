import { describe, expect, it } from "vitest";
import { expanderDemo } from "../../../src/demos/buttons/expander.js";
import { renderDemo } from "../../helpers/render-demo.js";

describe("expanderDemo", () => {
    it("exposes the expected metadata", () => {
        expect(expanderDemo.id).toBe("expander");
        expect(expanderDemo.title).toBe("Expander");
        expect(typeof expanderDemo.sourceCode).toBe("string");
    });

    it("renders the Details expander", async () => {
        if (!expanderDemo.component) throw new Error("expander demo component missing");
        const { container } = await renderDemo(expanderDemo.component);
        expect(container).toBeDefined();
    });
});
