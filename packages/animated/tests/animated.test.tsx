import type { ReactNode, Ref, RefObject } from "react";
import { animated, config, useSpring } from "@gtkx/animated";
import * as Graphene from "@gtkx/gi/graphene";
import * as Gsk from "@gtkx/gi/gsk";
import * as Gtk from "@gtkx/gi/gtk";
import {
    GtkAdjustment,
    GtkBox,
    GtkButton,
    GtkFixed,
    GtkFixedLayoutChild,
    GtkLabel,
    GtkSpinButton,
} from "@gtkx/jsx/gtk";
import { render, screen, waitFor } from "@gtkx/testing";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";

type OpacityProps = { labelRef: RefObject<Gtk.Label | null>; to: number; duration?: number };
type SwitchProps = { labelRef: RefObject<Gtk.Label | null>; mode: "first" | "second" | "static" };
type ForwardingProps = { ref?: Ref<Gtk.Label | null>; opacity?: number; renders: number[] };
type OpaqueProps = { opacity?: number; renders: number[] };

const ANIMATED = { areAnimationsEnabled: true };
const AnimatedAdjustment = animated(GtkAdjustment);
const AnimatedBox = animated(GtkBox);
const AnimatedButton = animated(GtkButton);
const AnimatedFixedLayoutChild = animated(GtkFixedLayoutChild);
const AnimatedLabel = animated(GtkLabel);
const AnimatedSpinButton = animated(GtkSpinButton);
const SLOW = { duration: 400 };
const LONG = { duration: 1500 };
const SETTLE = { timeout: 3000 };
const AnimatedForwarding = animated(Forwarding);
const AnimatedOpaque = animated(Opaque);

const translate = (x: number): Gsk.Transform | null => Gsk.Transform.new().translate(new Graphene.Point({ x, y: 0 }));

const Fade = ({ labelRef, to, duration = SLOW.duration }: OpacityProps): ReactNode => {
    const styles = useSpring({ from: { opacity: 0 }, to: { opacity: to }, config: { duration } });

    return <AnimatedLabel ref={labelRef} opacity={styles.opacity} label="fade" />;
};

const Switching = ({ labelRef, mode }: SwitchProps): ReactNode => {
    const first = useSpring({ from: { opacity: 0 }, to: { opacity: 1 }, config: LONG });
    const second = useSpring({ from: { opacity: 0.5 }, to: { opacity: 0.5 } });
    const springs = { first: first.opacity, second: second.opacity, static: 0 };

    return <AnimatedLabel ref={labelRef} opacity={springs[mode]} label="switching" />;
};

const Unpinned = ({ fixedRef }: { fixedRef: RefObject<Gtk.Fixed | null> }): ReactNode => {
    const { x } = useSpring({ from: { x: 30 }, to: { x: 0 }, config: SLOW });

    return (
        <GtkFixed ref={fixedRef}>
            <AnimatedFixedLayoutChild transform={x.to((current) => (current === 0 ? null : translate(current)))}>
                <GtkLabel>unpinned</GtkLabel>
            </AnimatedFixedLayoutChild>
        </GtkFixed>
    );
};

const Truncated = ({ boxRef }: { boxRef: RefObject<Gtk.Box | null> }): ReactNode => {
    const { value } = useSpring({ from: { value: 12.7 }, to: { value: 12.7 } });

    return <AnimatedBox ref={boxRef} marginStart={value} />;
};

const FadeCustom = ({ renders, isForwarding }: { renders: number[]; isForwarding: boolean }): ReactNode => {
    const styles = useSpring({ from: { opacity: 0 }, to: { opacity: 1 }, config: LONG });

    return isForwarding
        ? <AnimatedForwarding opacity={styles.opacity} renders={renders} />
        : <AnimatedOpaque opacity={styles.opacity} renders={renders} />;
};

const Counter = ({ labelRef }: { labelRef: RefObject<Gtk.Label | null> }): ReactNode => {
    const { value } = useSpring({ from: { value: 0 }, to: { value: 100 }, config: SLOW });

    return <AnimatedLabel ref={labelRef} label={value.to((current) => `${Math.round(current).toFixed(0)}%`)} />;
};

const TextCounter = (): ReactNode => {
    const { value } = useSpring({ from: { value: 0 }, to: { value: 50 }, config: SLOW });

    return <AnimatedLabel>{value.to((current) => Math.round(current).toFixed(0))}</AnimatedLabel>;
};

const MixedText = (): ReactNode => {
    const { value } = useSpring({ from: { value: 0 }, to: { value: 7 }, config: SLOW });

    return (
        <AnimatedLabel>
            {value.to((current) => Math.round(current).toFixed(0))}
            {" items"}
        </AnimatedLabel>
    );
};

const WholeMargins = ({ boxRef, seen }: { boxRef: RefObject<Gtk.Box | null>; seen: number[] }): ReactNode => {
    const styles = useSpring({
        from: { marginStart: 0 },
        to: { marginStart: 40 },
        config: SLOW,
        onChange: () => {
            seen.push(boxRef.current?.marginStart ?? -1);
        },
    });

    return <AnimatedBox ref={boxRef} marginStart={styles.marginStart} />;
};

const Wobbly = ({ labelRef, to }: OpacityProps): ReactNode => {
    const styles = useSpring({
        from: { opacity: 1 - to, marginStart: 40 * (1 - to) },
        to: { opacity: to, marginStart: 40 * to },
        config: config.wobbly,
    });

    return (
        <AnimatedLabel ref={labelRef} opacity={styles.opacity} marginStart={styles.marginStart} label="wobbly" />
    );
};

const NestedText = (): ReactNode => {
    const { value } = useSpring({ from: { value: 0 }, to: { value: 3 }, config: SLOW });

    return (
        <AnimatedLabel>
            {[value.to((current) => Math.round(current).toFixed(0)), " of "]}
            {["3", " done"]}
        </AnimatedLabel>
    );
};

const Controlled = ({ onValueChanged }: { onValueChanged: () => void }): ReactNode => {
    const { value } = useSpring({ from: { value: 0 }, to: { value: 50 }, config: SLOW });

    return (
        <AnimatedSpinButton
            adjustment={<AnimatedAdjustment lower={0} upper={100} stepIncrement={1} />}
            value={value}
            onValueChanged={onValueChanged}
        />
    );
};

const Margins = ({ boxRef }: { boxRef: RefObject<Gtk.Box | null> }): ReactNode => {
    const styles = useSpring({
        from: { marginStart: 0, marginTop: 0 },
        to: { marginStart: 40, marginTop: 8 },
        config: SLOW,
    });

    return <AnimatedBox ref={boxRef} marginStart={styles.marginStart} marginTop={styles.marginTop} />;
};

const Slide = ({ fixedRef }: { fixedRef: RefObject<Gtk.Fixed | null> }): ReactNode => {
    const { x } = useSpring({ from: { x: 0 }, to: { x: 60 }, config: SLOW });

    return (
        <GtkFixed ref={fixedRef}>
            <AnimatedFixedLayoutChild transform={x.to(translate)}>
                <GtkLabel>slide</GtkLabel>
            </AnimatedFixedLayoutChild>
        </GtkFixed>
    );
};

const Progress = (): ReactNode => {
    const { value } = useSpring({ from: { value: 0 }, to: { value: 100 }, config: SLOW });

    return <AnimatedButton accessibleLabel={value.to((current) => `Progress ${Math.round(current).toFixed(0)}`)} />;
};

function Forwarding({ ref, opacity, renders }: ForwardingProps): ReactNode {
    renders.push(opacity ?? -1);

    return <GtkLabel ref={ref} opacity={opacity} label="forwarding" />;
}

function Opaque({ opacity, renders }: OpaqueProps): ReactNode {
    renders.push(opacity ?? -1);

    return <GtkLabel opacity={opacity} label="opaque" />;
}

const expectOpacity = (label: Gtk.Label | null, opacity: number): Promise<void> =>
    waitFor(() => {
        expect(label?.getOpacity()).toBeCloseTo(opacity, 2);
    }, SETTLE);

const expectInFlight = (label: Gtk.Label | null): Promise<void> =>
    waitFor(() => {
        const opacity = label?.getOpacity() ?? 0;
        expect(opacity).toBeGreaterThan(0);
        expect(opacity).toBeLessThan(1);
    });

describe("animated - spring values on widgets", () => {
    it("drives a widget property through its frames to the target", async () => {
        const labelRef = createRef<Gtk.Label>();
        await render(<Fade labelRef={labelRef} to={1} duration={LONG.duration} />, ANIMATED);
        await expectInFlight(labelRef.current);
        await expectOpacity(labelRef.current, 1);
    });

    it("writes frames onto the widget without re-rendering a ref-forwarding component", async () => {
        const renders: number[] = [];
        await render(<FadeCustom renders={renders} isForwarding />, ANIMATED);
        const label = screen.getByText("forwarding");
        await expectInFlight(label as Gtk.Label);
        await expectOpacity(label as Gtk.Label, 1);
        expect(renders).toEqual([0]);
    });

    it("re-renders a component that keeps its ref to itself until the value settles", async () => {
        const renders: number[] = [];
        await render(<FadeCustom renders={renders} isForwarding={false} />, ANIMATED);
        const label = screen.getByText("opaque");
        await expectOpacity(label as Gtk.Label, 1);

        await waitFor(() => {
            expect(renders.at(-1)).toBe(1);
        });

        expect(renders.length).toBeGreaterThan(1);
    });
});

describe("animated - spring values across rerenders", () => {
    it("follows a new target after a rerender", async () => {
        const labelRef = createRef<Gtk.Label>();
        const { rerender } = await render(<Fade labelRef={labelRef} to={1} />, ANIMATED);
        await expectOpacity(labelRef.current, 1);
        await rerender(<Fade labelRef={labelRef} to={0.25} />);
        await expectOpacity(labelRef.current, 0.25);
    });

    it("takes a static value and a different spring that replace a running one", async () => {
        const labelRef = createRef<Gtk.Label>();
        const { rerender } = await render(<Switching labelRef={labelRef} mode="first" />, ANIMATED);
        await expectInFlight(labelRef.current);
        await rerender(<Switching labelRef={labelRef} mode="static" />);
        await expectOpacity(labelRef.current, 0);
        await rerender(<Switching labelRef={labelRef} mode="second" />);
        await expectOpacity(labelRef.current, 0.5);
    });
});

describe("animated - interpolations and shorthands", () => {
    it("applies an interpolated label and text children", async () => {
        const labelRef = createRef<Gtk.Label>();
        await render(<Counter labelRef={labelRef} />, ANIMATED);

        await waitFor(() => {
            expect(labelRef.current).toHaveObjectProperty("label", "100%");
        });
    });

    it("animates a fluid text child", async () => {
        await render(<TextCounter />, ANIMATED);
        expect(await screen.findByText("50")).toBeVisible();
    });

    it("animates a fluid text child next to static text", async () => {
        await render(<MixedText />, ANIMATED);
        expect(await screen.findByText("7 items")).toBeVisible();
    });

    it("animates fluid text nested inside arrays of children", async () => {
        await render(<NestedText />, ANIMATED);
        expect(await screen.findByText("3 of 3 done")).toBeVisible();
    });

    it("animates several properties at once", async () => {
        const boxRef = createRef<Gtk.Box>();
        await render(<Margins boxRef={boxRef} />, ANIMATED);

        await waitFor(() => {
            expect(boxRef.current).toHaveObjectProperty("marginStart", 40);
            expect(boxRef.current).toHaveObjectProperty("marginTop", 8);
        });
    });
});

describe("animated - transforms and wrappers", () => {
    it("moves a fixed child through an animated transform", async () => {
        const fixedRef = createRef<Gtk.Fixed>();
        await render(<Slide fixedRef={fixedRef} />, ANIMATED);
        const label = screen.getByText("slide");

        await waitFor(() => {
            expect(fixedRef.current?.getChildPosition(label)).toEqual([60, 0]);
        });
    });

    it("reuses one wrapper per component", () => {
        expect(animated(GtkLabel)).toBe(AnimatedLabel);
        expect(animated(Forwarding)).toBe(AnimatedForwarding);
        expect(AnimatedForwarding.displayName).toBe("Animated(Forwarding)");
    });

    it("accepts an interpolation that ends in a null transform", async () => {
        const fixedRef = createRef<Gtk.Fixed>();
        await render(<Unpinned fixedRef={fixedRef} />, ANIMATED);
        const label = screen.getByText("unpinned");

        await waitFor(() => {
            expect(fixedRef.current?.getChildTransform(label)).toBeNull();
        });

        expect(fixedRef.current?.getChildPosition(label)).toEqual([0, 0]);
    });
});

describe("animated - signal handlers", () => {
    it("does not echo animated writes through user-event handlers", async () => {
        const onValueChanged = vi.fn();
        await render(<Controlled onValueChanged={onValueChanged} />, ANIMATED);

        await waitFor(() => {
            expect(screen.getByRole(Gtk.AccessibleRole.SPIN_BUTTON)).toHaveValue(50);
        });

        expect(onValueChanged).not.toHaveBeenCalled();
    });
});

describe("animated - values the property cannot hold as written", () => {
    it("writes whole numbers to an integer property all along a spring", async () => {
        const boxRef = createRef<Gtk.Box>();
        const seen: number[] = [];
        await render(<WholeMargins boxRef={boxRef} seen={seen} />, ANIMATED);

        await waitFor(() => {
            expect(boxRef.current).toHaveObjectProperty("marginStart", 40);
        });

        const distinct = new Set(seen);
        expect(distinct.size).toBeGreaterThan(2);
        expect([...distinct].every((value) => Number.isSafeInteger(value))).toBe(true);
    });

    it("truncates toward zero the way JavaScript does", async () => {
        const boxRef = createRef<Gtk.Box>();
        await render(<Truncated boxRef={boxRef} />, ANIMATED);

        await waitFor(() => {
            expect(boxRef.current).toHaveObjectProperty("marginStart", 12);
        });
    });

    it("clamps an overshooting spring to the range the property allows", async () => {
        const labelRef = createRef<Gtk.Label>();
        const { rerender } = await render(<Wobbly labelRef={labelRef} to={1} />, ANIMATED);
        await expectOpacity(labelRef.current, 1);
        await rerender(<Wobbly labelRef={labelRef} to={0} />);
        await expectOpacity(labelRef.current, 0);
        expect(labelRef.current).toHaveObjectProperty("marginStart", 0);
    });
});

describe("animated - props without a native setter", () => {
    it("falls back to rendering through React for accessible props", async () => {
        await render(<Progress />, ANIMATED);
        expect(await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Progress 100" })).toBeVisible();
    });
});

describe("animated - error paths", () => {
    it("rejects a label that mixes an animated label prop with text children", async () => {
        await expect(render(<AnimatedLabel label="one">two</AnimatedLabel>)).rejects.toThrow();
    });

    it("throws when asked to wrap something that is not a component", () => {
        expect(() => animated(undefined as never)).toThrow();
    });
});
