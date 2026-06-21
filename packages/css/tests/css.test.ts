import type { MockInstance } from "vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createInstance, type Instance } from "../src/create-instance.js";
import { Stylesheet } from "../src/stylesheet.js";

describe("css", () => {
    let instance: Instance;

    beforeEach(() => {
        instance = createInstance({ key: "gtkx" });
    });

    it("creates a class name from template literal styles", () => {
        const className = instance.css`
            background: red;
        `;

        expect(className).toMatch(/^gtkx-/);
    });

    it("creates a class name from object styles", () => {
        const className = instance.css({
            padding: "12px",
            margin: "8px",
        });

        expect(className).toMatch(/^gtkx-/);
    });

    it("returns consistent class name for identical styles", () => {
        const className1 = instance.css`
            color: blue;
        `;
        const className2 = instance.css`
            color: blue;
        `;

        expect(className1).toBe(className2);
    });

    it("returns different class names for different styles", () => {
        const className1 = instance.css`
            color: red;
        `;
        const className2 = instance.css`
            color: green;
        `;

        expect(className1).not.toBe(className2);
    });

    it("handles nested style rules", () => {
        const className = instance.css`
            background: white;
            &:hover {
                background: gray;
            }
        `;

        expect(className).toMatch(/^gtkx-/);
    });

    it("handles interpolated values", () => {
        const color = "purple";
        const className = instance.css`
            background: ${color};
        `;

        expect(className).toMatch(/^gtkx-/);
    });

    it("handles GTK CSS variables", () => {
        const className = instance.css`
            background: @theme_bg_color;
            color: @theme_fg_color;
        `;

        expect(className).toMatch(/^gtkx-/);
    });

    it("handles array of styles", () => {
        const baseStyles = instance.css`
            padding: 4px;
        `;
        const additionalStyles = {
            margin: "8px",
        };
        const className = instance.css(baseStyles, additionalStyles);

        expect(className).toMatch(/^gtkx-/);
    });
});

describe("cx", () => {
    let instance: Instance;

    beforeEach(() => {
        instance = createInstance({ key: "gtkx" });
    });

    it("combines multiple class names into an array", () => {
        const result = instance.cx("class-a", "class-b", "class-c");

        expect(result).toEqual(["class-a", "class-b", "class-c"]);
    });

    it("merges multiple css outputs into a single last-wins override class", () => {
        const style1 = instance.css`
            color: red;
        `;
        const style2 = instance.css`
            color: blue;
        `;
        const result = instance.cx(style1, style2);

        expect(result).toHaveLength(1);
        const mergedClass = result[0];
        if (typeof mergedClass !== "string") throw new Error("cx should merge into one class");
        expect(mergedClass).toMatch(/^gtkx-/);
        expect(mergedClass).not.toBe(style1);
        expect(mergedClass).not.toBe(style2);

        const mergedStyles = instance.registeredStylesFor(mergedClass);
        const style1Styles = instance.registeredStylesFor(style1);
        const style2Styles = instance.registeredStylesFor(style2);
        expect(mergedStyles).toBe(`${style1Styles}${style2Styles}`);
        expect(mergedStyles?.lastIndexOf("color: blue")).toBeGreaterThan(mergedStyles?.lastIndexOf("color: red") ?? -1);
    });

    it("handles conditional composition", () => {
        const baseStyle = "base-class";
        const activeStyle = "active-class";
        const isActive = true;
        const isDisabled = false;

        const result = instance.cx(baseStyle, isActive && activeStyle, isDisabled && "disabled-class");

        expect(result).toEqual(["base-class", "active-class"]);
    });
});

describe("cx falsy filtering", () => {
    let instance: Instance;

    beforeEach(() => {
        instance = createInstance({ key: "gtkx" });
    });

    it("filters out false values", () => {
        const isActive = false;
        const result = instance.cx("base", isActive && "active");

        expect(result).toEqual(["base"]);
    });

    it("filters out undefined values", () => {
        const conditionalClass: string | undefined = undefined;
        const result = instance.cx("base", conditionalClass);

        expect(result).toEqual(["base"]);
    });

    it("filters out null values", () => {
        const conditionalClass: string | null = null;
        const result = instance.cx("base", conditionalClass);

        expect(result).toEqual(["base"]);
    });

    it("filters out empty strings", () => {
        const result = instance.cx("base", "", "other");

        expect(result).toEqual(["base", "other"]);
    });
});

describe("cx edge cases", () => {
    let instance: Instance;

    beforeEach(() => {
        instance = createInstance({ key: "gtkx" });
    });

    it("returns empty array when given no arguments", () => {
        const result = instance.cx();

        expect(result).toEqual([]);
    });

    it("returns empty array when all values are falsy", () => {
        const result = instance.cx(false, undefined, null, "");

        expect(result).toEqual([]);
    });

    it("handles single class name", () => {
        const result = instance.cx("single");

        expect(result).toEqual(["single"]);
    });

    it("handles many class names", () => {
        const result = instance.cx("a", "b", "c", "d", "e", "f", "g");

        expect(result).toEqual(["a", "b", "c", "d", "e", "f", "g"]);
    });
});

describe("injectGlobal", () => {
    let instance: Instance;

    beforeEach(() => {
        instance = createInstance({ key: "gtkx" });
    });

    it("accepts template literal styles", () => {
        expect(() => {
            instance.injectGlobal`
                window {
                    background: @theme_bg_color;
                }
            `;
        }).not.toThrow();
    });

    it("accepts object styles", () => {
        expect(() => {
            instance.injectGlobal({
                button: {
                    borderRadius: "6px",
                },
            });
        }).not.toThrow();
    });

    it("does not inject duplicate styles", () => {
        expect(() => {
            instance.injectGlobal`
                .global-unique-test {
                    color: red;
                }
            `;
            instance.injectGlobal`
                .global-unique-test {
                    color: red;
                }
            `;
        }).not.toThrow();
    });

    it("handles GTK widget selectors", () => {
        expect(() => {
            instance.injectGlobal`
                entry {
                    border: 1px solid @borders;
                }
                label {
                    font-weight: bold;
                }
            `;
        }).not.toThrow();
    });
});

describe("stylis pipeline correctness", () => {
    let instance: Instance;
    let insertSpy: MockInstance<Stylesheet["insert"]>;

    beforeEach(() => {
        insertSpy = vi.spyOn(Stylesheet.prototype, "insert");
        instance = createInstance({ key: "gtkx" });
    });

    afterEach(() => {
        insertSpy.mockRestore();
    });

    function findInsertedRule(selectorPrefix: string): string {
        const rules = insertSpy.mock.calls.map((call) => call[0] as string);
        const rule = rules.find((r) => r.startsWith(selectorPrefix));
        expect(rule).toBeDefined();
        return rule ?? "";
    }

    it("preserves declarations carrying GTK named colors", () => {
        const className = instance.css`
            background: @card_bg_color;
            color: alpha(@window_fg_color, 0.6);
            box-shadow: 0 0 0 1px alpha(@accent_bg_color, 0.4);
            border-radius: 12px;
        `;

        const rule = findInsertedRule(`.${className}`);
        expect(rule).toContain("background:@card_bg_color;");
        expect(rule).toContain("color:alpha(@window_fg_color, 0.6);");
        expect(rule).toContain("box-shadow:0 0 0 1px alpha(@accent_bg_color, 0.4);");
        expect(rule).toContain("border-radius:12px;");
        expect(rule).not.toContain("gtkx-named-color__");
    });

    it("preserves named colors inside nested selectors", () => {
        const className = instance.css`
            background: @card_bg_color;

            &:hover {
                background: @accent_bg_color;
            }
        `;

        const rules = insertSpy.mock.calls.map((call) => call[0] as string);
        const hoverRule = rules.find((rule) => rule.startsWith(`.${className}:hover`));
        expect(hoverRule).toBeDefined();
        expect(hoverRule).toContain("background:@accent_bg_color;");
    });

    it("keeps real at-rules intact alongside named colors", () => {
        const keyframes = instance.css`
            color: @theme_fg_color;
            @keyframes gtkx-test-spin {
                to {
                    color: @accent_bg_color;
                }
            }
        `;

        const rules = insertSpy.mock.calls.map((call) => call[0] as string);
        expect(rules.find((rule) => rule.startsWith(`.${keyframes}`))).toContain("color:@theme_fg_color;");
        const keyframesRule = rules.find((rule) => rule.startsWith("@keyframes"));
        expect(keyframesRule).toBeDefined();
        expect(keyframesRule).toContain("color:@accent_bg_color;");
    });

    it("scopes @media at-rules around the generated class selector", () => {
        const className = instance.css`
            color: red;
            @media (prefers-color-scheme: dark) {
                color: blue;
            }
        `;

        const rules = insertSpy.mock.calls.map((call) => call[0] as string);
        const mediaRule = rules.find((rule) => rule.startsWith("@media"));
        expect(mediaRule).toBeDefined();
        expect(mediaRule).toContain(`.${className}{color:blue;}`);
    });

    it("preserves & characters inside string literals", () => {
        const className = instance.css`
            font-family: "Helvetica & Arial";
        `;

        const rule = findInsertedRule(`.${className}`);
        expect(rule).toContain('font-family:"Helvetica & Arial"');
    });

    it("compounds nested & selectors instead of producing descendant combinators", () => {
        const className = instance.css`
            &:hover {
                &:focus {
                    color: red;
                }
            }
        `;

        const rules = insertSpy.mock.calls.map((call) => call[0] as string);
        const compound = rules.find((rule) => rule.includes(":hover") && rule.includes(":focus"));
        expect(compound).toBeDefined();
        expect(compound).toMatch(new RegExp(`^\\.${className}:hover:focus`));
        expect(compound).not.toMatch(/:hover\s+\..*:focus/);
    });

    it("strips Emotion label declarations before they reach the GTK sink", () => {
        const className = instance.css({ label: "btn", padding: "8px" });

        const rule = findInsertedRule(`.${className}`);
        expect(rule).toContain("padding:8px;");
        expect(rule).not.toContain("label:");
    });

    it("inlines a previously created class when interpolated into another css call", () => {
        const base = instance.css({ color: "red" });
        const composed = instance.css`
            ${base};
            padding: 8px;
        `;

        const rules = insertSpy.mock.calls.map((call) => call[0] as string);
        const rule = rules.find((r) => r.startsWith(`.${composed}`));
        expect(rule).toBeDefined();
        expect(rule).toContain("color:red");
        expect(rule).toContain("padding:8px");
    });

    it("emits the literal scoped rule for the simplest common path", () => {
        const className = instance.css({ background: "red" });

        const rule = findInsertedRule(`.${className}`);
        expect(rule).toBe(`.${className}{background:red;}`);
    });

    it("does not re-insert identical styles on the second css call", () => {
        instance.css({ background: "red" });
        const callsAfterFirst = insertSpy.mock.calls.length;

        instance.css({ background: "red" });
        expect(insertSpy.mock.calls.length).toBe(callsAfterFirst);
    });

    it("does not re-insert identical styles on the second injectGlobal call", () => {
        instance.injectGlobal({ window: { background: "red" } });
        const callsAfterFirst = insertSpy.mock.calls.length;

        instance.injectGlobal({ window: { background: "red" } });
        expect(insertSpy.mock.calls.length).toBe(callsAfterFirst);
    });
});
