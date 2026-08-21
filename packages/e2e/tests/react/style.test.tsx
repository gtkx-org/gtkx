import type { ComponentProps, ReactNode, RefObject } from "react";
import { css } from "@gtkx/css";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkLabel } from "@gtkx/jsx/gtk";
import { render, waitFor } from "@gtkx/testing";
import { createRef } from "react";
import { describe, expect, it } from "vitest";

type LabelStyle = ComponentProps<typeof GtkLabel>["style"];

type PairProps = {
    plainRef: RefObject<Gtk.Label | null>;
    styledRef: RefObject<Gtk.Label | null>;
    style?: LabelStyle;
    classes?: string[] | null | undefined;
};

type Pair = {
    plain: Gtk.Label;
    styled: Gtk.Label;
    restyle: (style: LabelStyle, classes?: string[] | null) => Promise<void>;
};

const RED = [1, 0, 0];
const GREEN = [0, 1, 0];
const BLUE = [0, 0, 1];
const RED_CSS = "rgb(255, 0, 0)";
const GREEN_CSS = "rgb(0, 255, 0)";
const NAMED_ALPHA = 0.4;
const WIDE = 200;
const NUL = "\u{0}";
const competing = css({ color: "rgb(0, 0, 255)" });

const Pair = ({ plainRef, styledRef, style, classes }: PairProps): ReactNode => (
    <GtkBox>
        <GtkLabel ref={plainRef}>plain</GtkLabel>
        <GtkLabel ref={styledRef} cssClasses={classes} style={style}>
            styled
        </GtkLabel>
    </GtkBox>
);

const mounted = <T,>(widget: T | null): T => {
    if (widget === null) {
        throw new Error("expected the widget to be mounted");
    }

    return widget;
};

const getColor = (widget: Gtk.Widget | null): number[] => {
    const color = mounted(widget).getColor();

    return [color.red, color.green, color.blue];
};

const getAlpha = (widget: Gtk.Widget | null): number => mounted(widget).getColor().alpha;

const getMinWidth = (widget: Gtk.Widget | null): number =>
    mounted(widget).measure(Gtk.Orientation.HORIZONTAL, -1)[0];

const generatedClasses = (widget: Gtk.Widget | null): string[] =>
    mounted(widget).getCssClasses().filter((name) => name.startsWith("gtkx-s"));

const renderPair = async (style: LabelStyle, classes?: string[] | null): Promise<Pair> => {
    const plainRef = createRef<Gtk.Label>();
    const styledRef = createRef<Gtk.Label>();

    const { rerender } = await render(
        <Pair plainRef={plainRef} styledRef={styledRef} style={style} classes={classes} />,
    );

    return {
        plain: mounted(plainRef.current),
        styled: mounted(styledRef.current),
        restyle: async (nextStyle, nextClasses) => {
            await rerender(
                <Pair plainRef={plainRef} styledRef={styledRef} style={nextStyle} classes={nextClasses} />,
            );
        },
    };
};

describe("style prop", () => {
    it("paints a widget from a plain style object", async () => {
        const { styled } = await renderPair({ color: RED_CSS });
        expect(getColor(styled)).toEqual(RED);
    });

    it("repaints the same widget when the style changes on a rerender", async () => {
        const { styled, restyle } = await renderPair({ color: RED_CSS });
        expect(getColor(styled)).toEqual(RED);
        await restyle({ color: GREEN_CSS });
        expect(getColor(styled)).toEqual(GREEN);
    });

    it("appends pixels to a bare number", async () => {
        const { styled } = await renderPair({ minWidth: WIDE });
        expect(getMinWidth(styled)).toBeGreaterThanOrEqual(WIDE);
    });

    it("resolves a GTK named color", async () => {
        const { styled } = await renderPair({ color: "alpha(@theme_fg_color, 0.4)" });
        expect(getAlpha(styled)).toBeCloseTo(NAMED_ALPHA, 2);
    });

    it("nests a block under the selector its key derives", async () => {
        const { styled } = await renderPair({ color: RED_CSS, "&:hover": { color: GREEN_CSS } });
        expect(getColor(styled)).toEqual(RED);
        styled.setStateFlags(Gtk.StateFlags.PRELIGHT, false);
        expect(getColor(styled)).toEqual(GREEN);
    });
});

describe("style prop alongside cssClasses", () => {
    it("keeps the classes the user asked for next to the one it generates", async () => {
        const { styled } = await renderPair({ color: RED_CSS }, ["heading"]);
        expect(styled).toHaveClass("heading");
        expect(generatedClasses(styled)).toHaveLength(1);
        expect(getColor(styled)).toEqual(RED);
    });

    it("keeps painting after cssClasses is set to null", async () => {
        const { styled, restyle } = await renderPair({ color: RED_CSS }, ["heading"]);
        await restyle({ color: RED_CSS }, null);
        expect(styled).not.toHaveClass("heading");
        expect(generatedClasses(styled)).toHaveLength(1);
        expect(getColor(styled)).toEqual(RED);
        await restyle({ color: GREEN_CSS }, null);
        expect(getColor(styled)).toEqual(GREEN);
    });

    it("outranks a class the css helper generated", async () => {
        const { styled, restyle } = await renderPair(undefined, [competing]);

        await waitFor(() => {
            expect(getColor(styled)).toEqual(BLUE);
        });

        await restyle({ color: GREEN_CSS }, [competing]);
        expect(getColor(styled)).toEqual(GREEN);
    });
});

describe("style prop removal", () => {
    it("clears the paint and the generated class when the prop goes away", async () => {
        const { plain, styled, restyle } = await renderPair({ color: RED_CSS });
        expect(getColor(styled)).toEqual(RED);
        await restyle(undefined);
        expect(getColor(styled)).toEqual(getColor(plain));
        expect(generatedClasses(styled)).toEqual([]);
    });

    it("strips the style from a widget the tree removes", async () => {
        const ref = createRef<Gtk.Label>();

        const { rerender } = await render(
            <GtkBox>
                <GtkLabel ref={ref} cssClasses={["heading"]} style={{ color: RED_CSS }}>
                    gone
                </GtkLabel>
            </GtkBox>,
        );

        const detached = mounted(ref.current);
        expect(getColor(detached)).toEqual(RED);
        expect(generatedClasses(detached)).toHaveLength(1);
        await rerender(<GtkBox />);
        expect(detached.getCssClasses()).toEqual(["heading"]);
    });

    it("paints the next styled widget on its own after one is removed", async () => {
        const ref = createRef<Gtk.Label>();

        const { rerender } = await render(
            <GtkBox>
                <GtkLabel style={{ color: RED_CSS }}>gone</GtkLabel>
            </GtkBox>,
        );

        await rerender(<GtkBox />);

        await rerender(
            <GtkBox>
                <GtkLabel ref={ref} style={{ color: GREEN_CSS }}>
                    fresh
                </GtkLabel>
            </GtkBox>,
        );

        expect(getColor(ref.current)).toEqual(GREEN);
    });
});

describe("style prop edge cases", () => {
    it("treats null the same as removing the prop", async () => {
        const { plain, styled, restyle } = await renderPair({ color: RED_CSS });
        expect(getColor(styled)).toEqual(RED);
        await restyle(null);
        expect(getColor(styled)).toEqual(getColor(plain));
        expect(generatedClasses(styled)).toEqual([]);
    });

    it("renders an empty style object with the paint it would have had", async () => {
        const { plain, styled } = await renderPair({});
        expect(getColor(styled)).toEqual(getColor(plain));
    });

    it("gives siblings their own paint", async () => {
        const first = createRef<Gtk.Label>();
        const second = createRef<Gtk.Label>();

        await render(
            <GtkBox>
                <GtkLabel ref={first} style={{ color: RED_CSS }}>
                    first
                </GtkLabel>
                <GtkLabel ref={second} style={{ color: GREEN_CSS }}>
                    second
                </GtkLabel>
            </GtkBox>,
        );

        expect(getColor(first.current)).toEqual(RED);
        expect(getColor(second.current)).toEqual(GREEN);
    });

    it("keeps both classes when cssClasses goes away and the style stays", async () => {
        const { styled, restyle } = await renderPair({ color: RED_CSS }, ["heading"]);
        await restyle({ color: RED_CSS });
        expect(styled).toHaveClass("heading");
        expect(generatedClasses(styled)).toHaveLength(1);
        expect(getColor(styled)).toEqual(RED);
    });

    it("leaves other widgets alone when a declaration tries to escape the selector", async () => {
        const { plain, styled, restyle } = await renderPair(undefined);
        const before = getColor(plain);
        await restyle({ color: `${RED_CSS}; } * { color: rgb(0, 0, 255)` });
        expect(getColor(styled)).toEqual(RED);
        expect(getColor(plain)).toEqual(before);
    });

    it("renders a declaration carrying a NUL byte", async () => {
        const { plain, styled } = await renderPair({ background: `url(a${NUL}b.png)` });
        expect(styled).toBeVisible();
        expect(getColor(styled)).toEqual(getColor(plain));
    });
});
