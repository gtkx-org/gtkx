import type { Element } from "stylis";
import type { MockInstance } from "vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createCss, type Css, removeLabel } from "../src/create-css.js";
import { StyleSheet } from "../src/stylesheet.js";

type CssFixture = { instance: Css; insertSpy: MockInstance<StyleSheet["insert"]> };

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

const soleClassName = (result: string[]): string => {
    expect(result).toHaveLength(1);
    const [merged] = result;

    if (typeof merged !== "string") {
        throw new TypeError("cx should merge into one class");
    }

    return merged;
};

const installCssFixture = (): CssFixture => {
    const fixture = {} as CssFixture;

    beforeEach(() => {
        fixture.insertSpy = vi.spyOn(StyleSheet.prototype, "insert");
        fixture.instance = createCss();
    });

    afterEach(() => {
        fixture.insertSpy.mockRestore();
    });

    return fixture;
};

const insertedRules = (fixture: CssFixture): string[] => fixture.insertSpy.mock.calls.map((call) => call[0]);

const findInsertedRule = (fixture: CssFixture, selectorPrefix: string): string => {
    const rule = insertedRules(fixture).find((candidate) => candidate.startsWith(selectorPrefix));

    if (rule === undefined) {
        throw new Error(`no inserted rule starts with '${selectorPrefix}'`);
    }

    return rule;
};

const isTruthyAtRuntime = (isValue: boolean): boolean => isValue;

const injectUniqueGlobal = (instance: Css): void => {
    instance.injectGlobal(`
        .global-unique-test {
            color: red;
        }
    `);
};

const injectWindowBackground = (instance: Css): void => {
    instance.injectGlobal(`
        window {
            background: @theme_bg_color;
        }
    `);
};

const injectWidgetSelectors = (instance: Css): void => {
    instance.injectGlobal(`
        entry {
            border: 1px solid @borders;
        }
        label {
            font-weight: bold;
        }
    `);
};

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

describe("css — class name generation", () => {
    const fixture = installCssFixture();

    it("creates a class name from template literal styles", () => {
        const className = fixture.instance.css`
            background: red;
        `;

        expect(className).toMatch(/^gtkx-/);
    });

    it("creates a class name from object styles", () => {
        const className = fixture.instance.css({
            padding: "12px",
            margin: "8px",
        });

        expect(className).toMatch(/^gtkx-/);
    });

    it("returns consistent class name for identical styles", () => {
        const className1 = fixture.instance.css`
            color: blue;
        `;

        const className2 = fixture.instance.css`
            color: blue;
        `;

        expect(className1).toBe(className2);
    });

    it("returns different class names for different styles", () => {
        const className1 = fixture.instance.css`
            color: red;
        `;

        const className2 = fixture.instance.css`
            color: green;
        `;

        expect(className1).not.toBe(className2);
    });
});

describe("css — nesting, interpolation, and composition", () => {
    const fixture = installCssFixture();

    it("handles nested style rules", () => {
        const className = fixture.instance.css`
            background: white;
            &:hover {
                background: gray;
            }
        `;

        expect(className).toMatch(/^gtkx-/);
    });

    it("handles interpolated values", () => {
        const color = "purple";

        const className = fixture.instance.css`
            background: ${color};
        `;

        expect(className).toMatch(/^gtkx-/);
    });

    it("preserves GTK named colors", () => {
        const className = fixture.instance.css`
            background: @theme_bg_color;
            color: @theme_fg_color;
        `;

        expect(className).toMatch(/^gtkx-/);
    });

    it("handles array of styles", () => {
        const baseStyles = fixture.instance.css`
            padding: 4px;
        `;

        const additionalStyles = {
            margin: "8px",
        };

        const className = fixture.instance.css(baseStyles, additionalStyles);
        expect(className).toMatch(/^gtkx-/);
    });
});

describe("cx", () => {
    const fixture = installCssFixture();

    it("combines multiple class names into an array", () => {
        const result = fixture.instance.cx("class-a", "class-b", "class-c");
        expect(result).toEqual(["class-a", "class-b", "class-c"]);
    });

    it("merges multiple css outputs into a single last-wins override class", () => {
        const style1 = fixture.instance.css`
            color: red;
        `;

        const style2 = fixture.instance.css`
            color: blue;
        `;

        const mergedClass = soleClassName(fixture.instance.cx(style1, style2));
        expect(mergedClass).toMatch(/^gtkx-/);
        expect(mergedClass).not.toBe(style1);
        expect(mergedClass).not.toBe(style2);
        const mergedRule = findInsertedRule(fixture, `.${mergedClass}`);
        expect(mergedRule).toContain("color:red;");
        expect(mergedRule).toContain("color:blue;");
        expect(mergedRule.lastIndexOf("color:blue")).toBeGreaterThan(mergedRule.lastIndexOf("color:red"));
    });

    it("handles conditional composition", () => {
        const isActive = isTruthyAtRuntime(true);
        const isDisabled = isTruthyAtRuntime(false);
        const result = fixture.instance.cx("base-class", isActive && "active-class", isDisabled && "disabled-class");
        expect(result).toEqual(["base-class", "active-class"]);
    });
});

describe("cx — falsy filtering", () => {
    const fixture = installCssFixture();

    it("filters out false values", () => {
        const isActive = isTruthyAtRuntime(false);
        const result = fixture.instance.cx("base", isActive && "active");
        expect(result).toEqual(["base"]);
    });

    it("filters out undefined values", () => {
        const conditionalClass: string | undefined = undefined;
        const result = fixture.instance.cx("base", conditionalClass);
        expect(result).toEqual(["base"]);
    });

    it("filters out null values", () => {
        const conditionalClass: string | null = null;
        const result = fixture.instance.cx("base", conditionalClass);
        expect(result).toEqual(["base"]);
    });

    it("filters out empty strings", () => {
        const result = fixture.instance.cx("base", "", "other");
        expect(result).toEqual(["base", "other"]);
    });
});

describe("cx — edge cases", () => {
    const fixture = installCssFixture();

    it("returns empty array when given no arguments", () => {
        expect(fixture.instance.cx()).toEqual([]);
    });

    it("returns empty array when all values are falsy", () => {
        expect(fixture.instance.cx(false, undefined, null, "")).toEqual([]);
    });

    it("handles single class name", () => {
        expect(fixture.instance.cx("single")).toEqual(["single"]);
    });

    it("handles many class names", () => {
        expect(fixture.instance.cx("a", "b", "c", "d", "e", "f", "g")).toEqual(["a", "b", "c", "d", "e", "f", "g"]);
    });
});

describe("injectGlobal", () => {
    const fixture = installCssFixture();

    it("accepts template literal styles", () => {
        expect(() => {
            injectWindowBackground(fixture.instance);
        }).not.toThrow();
    });

    it("accepts object styles", () => {
        expect(() => {
            fixture.instance.injectGlobal({
                button: {
                    borderRadius: "6px",
                },
            });
        }).not.toThrow();
    });

    it("does not inject duplicate styles", () => {
        expect(() => {
            injectUniqueGlobal(fixture.instance);
        }).not.toThrow();

        expect(() => {
            injectUniqueGlobal(fixture.instance);
        }).not.toThrow();
    });

    it("handles GTK widget selectors", () => {
        expect(() => {
            injectWidgetSelectors(fixture.instance);
        }).not.toThrow();
    });
});

describe("css — GTK named colors", () => {
    const fixture = installCssFixture();

    it("preserves declarations carrying GTK named colors", () => {
        const className = fixture.instance.css`
            background: @card_bg_color;
            color: alpha(@window_fg_color, 0.6);
            box-shadow: 0 0 0 1px alpha(@accent_bg_color, 0.4);
            border-radius: 12px;
        `;

        const rule = findInsertedRule(fixture, `.${className}`);
        expect(rule).toContain("background:@card_bg_color;");
        expect(rule).toContain("color:alpha(@window_fg_color, 0.6);");
        expect(rule).toContain("box-shadow:0 0 0 1px alpha(@accent_bg_color, 0.4);");
        expect(rule).toContain("border-radius:12px;");
        expect(rule).not.toContain("gtkx-named-color__");
    });

    it("preserves named colors inside nested selectors", () => {
        const className = fixture.instance.css`
            background: @card_bg_color;

            &:hover {
                background: @accent_bg_color;
            }
        `;

        expect(findInsertedRule(fixture, `.${className}:hover`)).toContain("background:@accent_bg_color;");
    });

    it("keeps real at-rules intact alongside named colors", () => {
        const keyframes = fixture.instance.css`
            color: @theme_fg_color;
            @keyframes gtkx-test-spin {
                to {
                    color: @accent_bg_color;
                }
            }
        `;

        expect(findInsertedRule(fixture, `.${keyframes}`)).toContain("color:@theme_fg_color;");
        expect(findInsertedRule(fixture, "@keyframes")).toContain("color:@accent_bg_color;");
    });
});

describe("css — at-rule and selector scoping", () => {
    const fixture = installCssFixture();

    it("scopes @media at-rules around the generated class selector", () => {
        const className = fixture.instance.css`
            color: red;
            @media (prefers-color-scheme: dark) {
                color: blue;
            }
        `;

        expect(findInsertedRule(fixture, "@media")).toContain(`.${className}{color:blue;}`);
    });

    it("preserves & characters inside string literals", () => {
        const className = fixture.instance.css`
            font-family: "Helvetica & Arial";
        `;

        expect(findInsertedRule(fixture, `.${className}`)).toContain('font-family:"Helvetica & Arial"');
    });

    it("compounds nested & selectors instead of producing descendant combinators", () => {
        const className = fixture.instance.css`
            &:hover {
                &:focus {
                    color: red;
                }
            }
        `;

        const compound = insertedRules(fixture).find((rule) => rule.includes(":hover") && rule.includes(":focus"));
        expect(compound).toBeDefined();
        expect(compound).toMatch(new RegExp(String.raw`^\.${className}:hover:focus`));
        expect(compound).not.toMatch(/:hover\s+\..*:focus/);
    });
});

describe("css — rule shape and deduplication", () => {
    const fixture = installCssFixture();

    it("strips Emotion label declarations before they reach the GTK sink", () => {
        const className = fixture.instance.css({ label: "btn", padding: "8px" });
        const rule = findInsertedRule(fixture, `.${className}`);
        expect(rule).toContain("padding:8px;");
        expect(rule).not.toContain("label:");
    });

    it("inlines a previously created class when interpolated into another css call", () => {
        const base = fixture.instance.css({ color: "red" });

        const composed = fixture.instance.css`
            ${base};
            padding: 8px;
        `;

        const rule = findInsertedRule(fixture, `.${composed}`);
        expect(rule).toContain("color:red");
        expect(rule).toContain("padding:8px");
    });

    it("emits the literal scoped rule for the simplest common path", () => {
        const className = fixture.instance.css({ background: "red" });
        expect(findInsertedRule(fixture, `.${className}`)).toBe(`.${className}{background:red;}`);
    });

    it("does not re-insert identical styles on the second css call", () => {
        fixture.instance.css({ background: "red" });
        const callsAfterFirst = fixture.insertSpy.mock.calls.length;
        fixture.instance.css({ background: "red" });
        expect(fixture.insertSpy.mock.calls).toHaveLength(callsAfterFirst);
    });

    it("does not re-insert identical styles on the second injectGlobal call", () => {
        fixture.instance.injectGlobal({ window: { background: "red" } });
        const callsAfterFirst = fixture.insertSpy.mock.calls.length;
        fixture.instance.injectGlobal({ window: { background: "red" } });
        expect(fixture.insertSpy.mock.calls).toHaveLength(callsAfterFirst);
    });
});
