import type { ReactNode, RefObject } from "react";
import {
    animated,
    Spring,
    useChain,
    useSpring,
    useSpringRef,
    useSprings,
    useTrail,
    useTransition,
} from "@gtkx/animated";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkLabel } from "@gtkx/jsx/gtk";
import { render, screen, waitFor } from "@gtkx/testing";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";

type ItemsProps = { items: string[]; onDestroyed: (item: string) => void };
type TrailProps = { refs: RefObject<Gtk.Label | null>[] };
type ChainedProps = { firstRef: RefObject<Gtk.Label | null>; secondRef: RefObject<Gtk.Label | null> };
type DetachableProps = { isShown: boolean; onRest: () => void };

const ANIMATED = { areAnimationsEnabled: true };
const AnimatedLabel = animated(GtkLabel);
const SLOW = { duration: 300 };
const LONG = { duration: 1500 };
const SETTLE = { timeout: 3000 };

const Items = ({ items, onDestroyed }: ItemsProps): ReactNode => {
    const transitions = useTransition(items, {
        from: { opacity: 0 },
        enter: { opacity: 1 },
        leave: { opacity: 0 },
        config: SLOW,
        onDestroyed: (item) => {
            onDestroyed(item);
        },
    });

    return (
        <GtkBox>
            {transitions((styles, item) => (
                <AnimatedLabel opacity={styles.opacity} label={item} />
            ))}
        </GtkBox>
    );
};

const TrailedLabels = ({ refs }: TrailProps): ReactNode => {
    const trail = useTrail(refs.length, { from: { opacity: 0 }, to: { opacity: 1 }, config: SLOW });

    return (
        <GtkBox>
            {trail.map((styles, index) => (
                <AnimatedLabel key={String(index)} ref={refs[index]} opacity={styles.opacity} label="trail" />
            ))}
        </GtkBox>
    );
};

const Chained = ({ firstRef, secondRef }: ChainedProps): ReactNode => {
    const firstSpring = useSpringRef();
    const secondSpring = useSpringRef();
    const first = useSpring({ ref: firstSpring, from: { opacity: 0 }, to: { opacity: 1 }, config: SLOW });
    const second = useSpring({ ref: secondSpring, from: { marginStart: 0 }, to: { marginStart: 24 }, config: SLOW });
    useChain([firstSpring, secondSpring]);

    return (
        <GtkBox>
            <AnimatedLabel ref={firstRef} opacity={first.opacity} label="first" />
            <AnimatedLabel ref={secondRef} marginStart={second.marginStart} label="second" />
        </GtkBox>
    );
};

const Sprung = ({ refs }: TrailProps): ReactNode => {
    const [springs] = useSprings(refs.length, (index) => ({
        from: { opacity: 0 },
        to: { opacity: (index + 1) / 4 },
        config: SLOW,
    }));

    return (
        <GtkBox>
            {springs.map((styles, index) => (
                <AnimatedLabel key={String(index)} ref={refs[index]} opacity={styles.opacity} label="sprung" />
            ))}
        </GtkBox>
    );
};

const Detachable = ({ isShown, onRest }: DetachableProps): ReactNode => {
    const styles = useSpring({ from: { opacity: 0 }, to: { opacity: 1 }, config: LONG, onRest });

    return isShown ? <AnimatedLabel opacity={styles.opacity} label="detachable" /> : <GtkLabel label="gone" />;
};

const expectOpacity = (label: Gtk.Label | null, opacity: number): Promise<void> =>
    waitFor(() => {
        expect(label?.getOpacity()).toBeCloseTo(opacity, 2);
    });

describe("transitions - useTransition", () => {
    it("fades items in, keeps leaving items until they fade out, then drops them", async () => {
        const onDestroyed = vi.fn();
        const { rerender } = await render(<Items items={["one"]} onDestroyed={onDestroyed} />, ANIMATED);
        const one = screen.getByText("one");
        await expectOpacity(one as Gtk.Label, 1);
        await rerender(<Items items={["two"]} onDestroyed={onDestroyed} />);
        expect(screen.getByText("one")).toBe(one);

        await waitFor(() => {
            expect(onDestroyed).toHaveBeenCalledWith("one");
        });

        expect(screen.queryByText("one")).toBeNull();
        await expectOpacity(screen.getByText("two"), 1);
    });
});

describe("transitions - hooks and components", () => {
    it("runs a trail to completion", async () => {
        const refs = [createRef<Gtk.Label>(), createRef<Gtk.Label>(), createRef<Gtk.Label>()];
        await render(<TrailedLabels refs={refs} />, ANIMATED);

        for (const ref of refs) {
            await expectOpacity(ref.current, 1);
        }
    });

    it("chains springs through spring refs", async () => {
        const firstRef = createRef<Gtk.Label>();
        const secondRef = createRef<Gtk.Label>();
        await render(<Chained firstRef={firstRef} secondRef={secondRef} />, ANIMATED);
        await expectOpacity(firstRef.current, 1);

        await waitFor(() => {
            expect(secondRef.current).toHaveObjectProperty("marginStart", 24);
        });
    });

    it("drives several springs at once", async () => {
        const refs = [createRef<Gtk.Label>(), createRef<Gtk.Label>()];
        await render(<Sprung refs={refs} />, ANIMATED);
        await expectOpacity(refs[0]?.current ?? null, 0.25);
        await expectOpacity(refs[1]?.current ?? null, 0.5);
    });
});

describe("transitions - lifecycle", () => {
    it("renders the Spring component with animated children", async () => {
        const labelRef = createRef<Gtk.Label>();

        await render(
            <Spring from={{ opacity: 0 }} to={{ opacity: 1 }} config={SLOW}>
                {(styles) => <AnimatedLabel ref={labelRef} opacity={styles.opacity} label="spring" />}
            </Spring>,
            ANIMATED,
        );

        await expectOpacity(labelRef.current, 1);
    });

    it("lets the spring finish after its animated widget unmounts", async () => {
        const onRest = vi.fn();
        const { rerender } = await render(<Detachable isShown onRest={onRest} />, ANIMATED);
        await rerender(<Detachable isShown={false} onRest={onRest} />);
        expect(screen.getByText("gone")).toBeVisible();

        await waitFor(() => {
            expect(onRest).toHaveBeenCalledTimes(1);
        }, SETTLE);
    });

    it("settles the spring once when the whole tree unmounts mid-flight", async () => {
        const onRest = vi.fn();
        const { unmount } = await render(<Detachable isShown onRest={onRest} />, ANIMATED);
        const label = screen.getByText("detachable");

        await waitFor(() => {
            expect(label.getOpacity()).toBeGreaterThan(0);
        });

        await unmount();

        await waitFor(() => {
            expect(onRest).toHaveBeenCalledTimes(1);
        });
    });
});
