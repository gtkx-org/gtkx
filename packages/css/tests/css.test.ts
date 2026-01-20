import { describe, expect, it } from "vitest";
import { css, cx, injectGlobal } from "../src/index.js";

describe("css", () => {
    it("creates a class name from template literal styles", () => {
        const className = css`
            background: red;
        `;

        expect(className).toMatch(/^gtkx-/);
    });

    it("creates a class name from object styles", () => {
        const className = css({
            padding: "12px",
            margin: "8px",
        });

        expect(className).toMatch(/^gtkx-/);
    });

    it("returns consistent class name for identical styles", () => {
        const className1 = css`
            color: blue;
        `;
        const className2 = css`
            color: blue;
        `;

        expect(className1).toBe(className2);
    });

    it("returns different class names for different styles", () => {
        const className1 = css`
            color: red;
        `;
        const className2 = css`
            color: green;
        `;

        expect(className1).not.toBe(className2);
    });

    it("handles nested style rules", () => {
        const className = css`
            background: white;
            &:hover {
                background: gray;
            }
        `;

        expect(className).toMatch(/^gtkx-/);
    });

    it("handles interpolated values", () => {
        const color = "purple";
        const className = css`
            background: ${color};
        `;

        expect(className).toMatch(/^gtkx-/);
    });

    it("handles GTK CSS variables", () => {
        const className = css`
            background: @theme_bg_color;
            color: @theme_fg_color;
        `;

        expect(className).toMatch(/^gtkx-/);
    });

    it("handles array of styles", () => {
        const baseStyles = css`
            padding: 4px;
        `;
        const additionalStyles = {
            margin: "8px",
        };
        const className = css(baseStyles, additionalStyles);

        expect(className).toMatch(/^gtkx-/);
    });
});

describe("cx", () => {
    it("combines multiple class names into an array", () => {
        const result = cx("class-a", "class-b", "class-c");

        expect(result).toEqual(["class-a", "class-b", "class-c"]);
    });

    it("filters out false values", () => {
        const isActive = false;
        const result = cx("base", isActive && "active");

        expect(result).toEqual(["base"]);
    });

    it("filters out undefined values", () => {
        const conditionalClass: string | undefined = undefined;
        const result = cx("base", conditionalClass);

        expect(result).toEqual(["base"]);
    });

    it("filters out null values", () => {
        const conditionalClass: string | null = null;
        const result = cx("base", conditionalClass);

        expect(result).toEqual(["base"]);
    });

    it("filters out empty strings", () => {
        const result = cx("base", "", "other");

        expect(result).toEqual(["base", "other"]);
    });

    it("works with css function output", () => {
        const style1 = css`
            color: red;
        `;
        const style2 = css`
            color: blue;
        `;
        const result = cx(style1, style2);

        expect(result).toHaveLength(2);
        expect(result[0]).toMatch(/^gtkx-/);
        expect(result[1]).toMatch(/^gtkx-/);
    });

    it("handles conditional composition", () => {
        const baseStyle = "base-class";
        const activeStyle = "active-class";
        const isActive = true;
        const isDisabled = false;

        const result = cx(baseStyle, isActive && activeStyle, isDisabled && "disabled-class");

        expect(result).toEqual(["base-class", "active-class"]);
    });

    describe("edge cases", () => {
        it("returns empty array when given no arguments", () => {
            const result = cx();

            expect(result).toEqual([]);
        });

        it("returns empty array when all values are falsy", () => {
            const result = cx(false, undefined, null, "");

            expect(result).toEqual([]);
        });

        it("handles single class name", () => {
            const result = cx("single");

            expect(result).toEqual(["single"]);
        });

        it("handles many class names", () => {
            const result = cx("a", "b", "c", "d", "e", "f", "g");

            expect(result).toEqual(["a", "b", "c", "d", "e", "f", "g"]);
        });
    });
});

describe("injectGlobal", () => {
    it("accepts template literal styles", () => {
        expect(() => {
            injectGlobal`
                window {
                    background: @theme_bg_color;
                }
            `;
        }).not.toThrow();
    });

    it("accepts object styles", () => {
        expect(() => {
            injectGlobal({
                button: {
                    borderRadius: "6px",
                },
            });
        }).not.toThrow();
    });

    it("does not inject duplicate styles", () => {
        expect(() => {
            injectGlobal`
                .global-unique-test {
                    color: red;
                }
            `;
            injectGlobal`
                .global-unique-test {
                    color: red;
                }
            `;
        }).not.toThrow();
    });

    it("handles GTK widget selectors", () => {
        expect(() => {
            injectGlobal`
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
