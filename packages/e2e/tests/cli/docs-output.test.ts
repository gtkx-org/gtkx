import { describe, it } from "vitest";
import { expectReferenceLinks } from "./docs-output-fixture.js";

describe("generated reference output root links", () => {
    it.each([
        { basePath: "/", expected: "" },
        { basePath: "/reference", expected: "/reference" },
    ])("links pages beneath $basePath", (parameters) => {
        expectReferenceLinks(parameters);
    });
});
