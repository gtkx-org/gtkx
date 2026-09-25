import { describe, it } from "vitest";
import { expectReferenceLinks } from "./docs-output-fixture.js";

describe("generated reference output prefixed links", () => {
    it.each([
        { basePath: "/reference/", expected: "/reference" },
        { basePath: "https://docs.example.test/reference/", expected: "https://docs.example.test/reference" },
    ])("links pages beneath $basePath", (parameters) => {
        expectReferenceLinks(parameters);
    });
});
