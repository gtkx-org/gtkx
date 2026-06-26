import type { Element } from "stylis";
import { describe, expect, it } from "vitest";
import { removeLabel } from "../src/stylis-plugins.js";

const declElement = (value: string): Element => ({
    parent: null,
    children: "",
    root: null,
    type: "decl",
    props: "",
    value,
    length: value.length,
    return: `${value};`,
    line: 0,
    column: 0,
});

describe("removeLabel", () => {
    it("clears a label declaration", () => {
        const element = declElement("label:btn");
        removeLabel(element);
        expect(element.value).toBe("");
        expect(element.return).toBe("");
    });

    it("leaves a non-label declaration intact", () => {
        const element = declElement("padding:8px");
        removeLabel(element);
        expect(element.value).toBe("padding:8px");
        expect(element.return).toBe("padding:8px;");
    });
});
