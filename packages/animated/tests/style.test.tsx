import type { ComponentProps, ReactNode, Ref, RefObject } from "react";
import { animated, useSpring } from "@gtkx/animated";
import * as Graphene from "@gtkx/gi/graphene";
import * as Gsk from "@gtkx/gi/gsk";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkButton, GtkFixed, GtkFixedLayoutChild, GtkLabel } from "@gtkx/jsx/gtk";
import { act, render, screen, waitFor } from "@gtkx/testing";
import { createRef, useEffect, useState } from "react";
import { describe, expect, it } from "vitest";

type LabelStyle = ComponentProps<typeof GtkLabel>["style"];
type ForwardingProps = { ref?: Ref<Gtk.Label | null>; style?: LabelStyle; renders: LabelStyle[] };
type OpaqueProps = { style?: LabelStyle; renders: LabelStyle[] };
type WideningProps = { renders: LabelStyle[]; isForwarding: boolean };
type Rerender = { run: (() => void) | null };
type RefOnlyProps = { ref?: Ref<Gtk.Label | null>; style?: LabelStyle };
type Channel = "red" | "green" | "blue";
type SlideProps = { renders: number[] };

const ANIMATED = { areAnimationsEnabled: true };
const SLOW = { duration: 400 };
const LONG = { duration: 1500 };
const SETTLE = { timeout: 3000 };
const NARROW = 100;
const WIDE = 200;
const OFFSET = 8;
const STATIC_WIDTH = 140;
const AnimatedForwarding = animated(Forwarding);
const AnimatedOpaque = animated(Opaque);
const AnimatedRefOnly = animated(RefOnly);
const RED = "rgb(255, 0, 0)";
const BLUE = "rgb(0, 0, 255)";
const GREEN = "rgb(0, 255, 0)";
const SLIDE_TO = 120;
const AnimatedFixedLayoutChild = animated(GtkFixedLayoutChild);
const rerenderRefOnly: Rerender = { run: null };

const Widening = ({ labelRef }: { labelRef: RefObject<Gtk.Label | null> }): ReactNode => {
    const { width } = useSpring({ from: { width: NARROW }, to: { width: WIDE }, config: LONG });

    return <animated.GtkLabel ref={labelRef} style={width.to((current) => ({ minWidth: current }))} label="widening" />;
};

const Combined = ({ labelRef }: { labelRef: RefObject<Gtk.Label | null> }): ReactNode => {
    const styles = useSpring({
        from: { fade: 0, offset: 0, width: NARROW },
        to: { fade: 1, offset: OFFSET, width: WIDE },
        config: SLOW,
    });

    return (
        <animated.GtkLabel
            ref={labelRef}
            opacity={styles.fade}
            marginTop={styles.offset}
            style={styles.width.to((current) => ({ minWidth: current }))}
            label="combined"
        />
    );
};

const Vanishing = ({ labelRef }: { labelRef: RefObject<Gtk.Label | null> }): ReactNode => {
    const { width } = useSpring({ from: { width: WIDE }, to: { width: 0 }, config: SLOW });

    return (
        <animated.GtkLabel
            ref={labelRef}
            style={width.to((current) => (current === 0 ? null : { minWidth: current }))}
            label="vanishing"
        />
    );
};

const WideningCustom = ({ renders, isForwarding }: WideningProps): ReactNode => {
    const { width } = useSpring({ from: { width: NARROW }, to: { width: WIDE }, config: LONG });
    const style = width.to((current) => ({ minWidth: current }));

    return isForwarding
        ? <AnimatedForwarding style={style} renders={renders} />
        : <AnimatedOpaque style={style} renders={renders} />;
};

function Forwarding({ ref, style, renders }: ForwardingProps): ReactNode {
    renders.push(style);

    return <GtkLabel ref={ref} style={style} label="forwarding" />;
}

function Opaque({ style, renders }: OpaqueProps): ReactNode {
    renders.push(style);

    return <GtkLabel style={style} label="opaque" />;
}

function RefOnly({ ref }: RefOnlyProps): ReactNode {
    const [count, setCount] = useState(0);

    useEffect(() => {
        rerenderRefOnly.run = () => {
            setCount((current) => current + 1);
        };
    }, []);

    return <GtkLabel ref={ref} label={`ref only ${count.toString()}`} />;
}

const WideningRefOnly = (): ReactNode => {
    const { width } = useSpring({ from: { width: NARROW }, to: { width: WIDE }, config: SLOW });

    return <AnimatedRefOnly style={width.to((current) => ({ minWidth: current }))} />;
};

const WholeObject = ({ labelRef }: { labelRef: RefObject<Gtk.Label | null> }): ReactNode => {
    const styles = useSpring({ from: { color: RED }, to: { color: BLUE }, config: SLOW });

    return <animated.GtkLabel ref={labelRef} style={styles} label="whole object" />;
};

const OneDeclaration = ({ labelRef }: { labelRef: RefObject<Gtk.Label | null> }): ReactNode => {
    const { tint } = useSpring({ from: { tint: RED }, to: { tint: BLUE }, config: SLOW });

    return <animated.GtkLabel ref={labelRef} style={{ color: tint, paddingTop: 2 }} label="one declaration" />;
};

const NestedBlock = ({ labelRef }: { labelRef: RefObject<Gtk.Label | null> }): ReactNode => {
    const { tint } = useSpring({ from: { tint: RED }, to: { tint: BLUE }, config: SLOW });

    return (
        <animated.GtkLabel ref={labelRef} style={{ color: GREEN, "&:hover": { color: tint } }} label="nested block" />
    );
};

const Slide = ({ renders }: SlideProps): ReactNode => {
    const { x } = useSpring({ from: { x: 0 }, to: { x: SLIDE_TO }, config: SLOW });
    renders.push(1);

    return (
        <GtkFixed>
            <AnimatedFixedLayoutChild transform={x.to(translate)}>
                <GtkButton label="slide" />
            </AnimatedFixedLayoutChild>
        </GtkFixed>
    );
};

const translate = (x: number): Gsk.Transform | null => Gsk.Transform.new().translate(new Graphene.Point({ x, y: 0 }));
const getMinWidth = (widget: Gtk.Widget | null): number => widget?.measure(Gtk.Orientation.HORIZONTAL, -1)[0] ?? -1;

const expectMinWidth = (widget: Gtk.Widget | null, minWidth: number): Promise<void> =>
    waitFor(() => {
        expect(getMinWidth(widget)).toBe(minWidth);
    }, SETTLE);

const expectChannel = (widget: Gtk.Label | null, channel: Channel): Promise<void> =>
    waitFor(() => {
        expect(widget?.getColor()[channel]).toBeCloseTo(1, 1);
    }, SETTLE);

const expectWidening = (widget: Gtk.Widget | null): Promise<void> =>
    waitFor(() => {
        const minWidth = getMinWidth(widget);
        expect(minWidth).toBeGreaterThan(NARROW);
        expect(minWidth).toBeLessThan(WIDE);
    });

describe("animated - style", () => {
    it("drives a style through its frames to the target", async () => {
        const labelRef = createRef<Gtk.Label>();
        await render(<Widening labelRef={labelRef} />, ANIMATED);
        await expectWidening(labelRef.current);
        await expectMinWidth(labelRef.current, WIDE);
    });

    it("writes style frames onto the widget without re-rendering a ref-forwarding component", async () => {
        const renders: LabelStyle[] = [];
        await render(<WideningCustom renders={renders} isForwarding />, ANIMATED);
        const label = screen.getByText("forwarding");
        await expectWidening(label);
        await expectMinWidth(label, WIDE);
        expect(renders).toEqual([{ minWidth: NARROW }]);
    });

    it("lands a style and GObject properties in the same write pass", async () => {
        const labelRef = createRef<Gtk.Label>();
        await render(<Combined labelRef={labelRef} />, ANIMATED);

        await waitFor(() => {
            expect(labelRef.current).toHaveObjectProperty("marginTop", OFFSET);
        }, SETTLE);

        expect(labelRef.current?.getOpacity()).toBeCloseTo(1, 2);
        expect(getMinWidth(labelRef.current)).toBe(WIDE);
    });
});

describe("animated - style edge cases", () => {
    it("applies a style that is not a spring", async () => {
        const labelRef = createRef<Gtk.Label>();
        await render(<animated.GtkLabel ref={labelRef} style={{ minWidth: STATIC_WIDTH }} label="static" />, ANIMATED);
        expect(getMinWidth(labelRef.current)).toBe(STATIC_WIDTH);
    });

    it("accepts an interpolation that ends in a null style", async () => {
        const labelRef = createRef<Gtk.Label>();
        await render(<Vanishing labelRef={labelRef} />, ANIMATED);
        expect(getMinWidth(labelRef.current)).toBe(WIDE);

        await waitFor(() => {
            expect(labelRef.current?.getCssClasses()).toEqual([]);
        }, SETTLE);

        expect(getMinWidth(labelRef.current)).toBeLessThan(WIDE);
    });

    it("keeps a style the spring applied when only the inner component re-renders", async () => {
        await render(<WideningRefOnly />, ANIMATED);
        const label = screen.getByText(/^ref only/);
        await expectMinWidth(label, WIDE);

        await act(() => {
            rerenderRefOnly.run?.();
        });

        expect(getMinWidth(label)).toBe(WIDE);
    });

    it("re-renders a component that keeps its ref to itself until the style settles", async () => {
        const renders: LabelStyle[] = [];
        await render(<WideningCustom renders={renders} isForwarding={false} />, ANIMATED);
        const label = screen.getByText("opaque");
        await expectMinWidth(label, WIDE);
        expect(renders.length).toBeGreaterThan(1);
    });
});

describe("animated - springs inside a style object", () => {
    it("animates the object a spring hook returns, handed straight to style", async () => {
        const labelRef = createRef<Gtk.Label>();
        await render(<WholeObject labelRef={labelRef} />, ANIMATED);
        await expectChannel(labelRef.current, "blue");
        expect(labelRef.current?.getColor().red).toBeCloseTo(0, 1);
    });

    it("animates one declaration beside plain ones", async () => {
        const labelRef = createRef<Gtk.Label>();
        await render(<OneDeclaration labelRef={labelRef} />, ANIMATED);
        await expectChannel(labelRef.current, "blue");
    });

    it("animates a declaration inside a nested selector block", async () => {
        const labelRef = createRef<Gtk.Label>();
        await render(<NestedBlock labelRef={labelRef} />, ANIMATED);
        await expectChannel(labelRef.current, "green");
        labelRef.current?.setStateFlags(Gtk.StateFlags.PRELIGHT, false);
        await expectChannel(labelRef.current, "blue");
    });

    it("leaves a GObject-valued prop alone instead of walking into it", async () => {
        const renders: number[] = [];
        await render(<Slide renders={renders} />, ANIMATED);

        await waitFor(() => {
            expect(screen.getByText("slide")).toBeVisible();
        });

        expect(renders).toHaveLength(1);
    });
});
