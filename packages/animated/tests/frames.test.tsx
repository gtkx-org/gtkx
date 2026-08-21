import type { ReactNode, RefObject } from "react";
import { animated, useSpring } from "@gtkx/animated";
import * as GLib from "@gtkx/gi/glib";
import * as Gtk from "@gtkx/gi/gtk";
import { render, waitFor } from "@gtkx/testing";
import { createRef } from "react";
import { afterEach, describe, expect, it } from "vitest";

type FadeProps = {
    labelRef: RefObject<Gtk.Label | null>;
    counters: number[];
    duration: number;
    to?: number;
    stamps?: number[];
};

const ANIMATED = { areAnimationsEnabled: true };
const STALL_GAP_MS = 200;
const TIMER_FRAME_MS = 16;
const CLOCK_SPEEDUP = 2;
const extraWindows: Gtk.Window[] = [];

const Fade = ({ labelRef, counters, duration, to = 1, stamps }: FadeProps): ReactNode => {
    const styles = useSpring({
        from: { opacity: 0 },
        to: { opacity: to },
        config: { duration },
        onChange: () => {
            counters.push(Number(labelRef.current?.getFrameClock()?.getFrameCounter() ?? -1));
            stamps?.push(performance.now());
        },
    });

    return <animated.GtkLabel ref={labelRef} opacity={styles.opacity} label="fade" />;
};

const presentExtraWindow = async (): Promise<Gtk.Window> => {
    const window = new Gtk.Window({ title: "driver" });
    extraWindows.push(window);
    window.present();

    await waitFor(() => {
        expect(window.getMapped()).toBe(true);
    });

    return window;
};

const didBlockMainLoop = (duration: number): boolean => {
    const end = performance.now() + duration;
    let spins = 0;

    while (performance.now() < end) {
        spins += 1;
    }

    return spins > 0;
};

const blockMainLoopSoon = (delay: number, duration: number): void => {
    GLib.timeoutAdd(GLib.PRIORITY_DEFAULT, delay, () =>
        didBlockMainLoop(duration) ? GLib.SOURCE_REMOVE : GLib.SOURCE_CONTINUE,
    );
};

const timerFrames = (duration: number): number => Math.ceil(duration / TIMER_FRAME_MS);

const countBetween = (stamps: number[], start: number, end: number): number =>
    stamps.filter((stamp) => stamp > start && stamp < end).length;

const expectClockDriven = (counters: number[], frames: number, duration: number): void => {
    expect(new Set(counters).size).toBe(counters.length);
    expect(frames).toBeGreaterThan(CLOCK_SPEEDUP * timerFrames(duration));
};

const expectSettled = (labelRef: RefObject<Gtk.Label | null>, timeout: number): Promise<void> =>
    waitFor(() => {
        expect(labelRef.current?.getOpacity()).toBe(1);
    }, { timeout });

afterEach(() => {
    for (const window of extraWindows) {
        window.destroy();
    }

    extraWindows.length = 0;
});

describe("frames - frame clock", () => {
    it("advances the spring with the window's frame clock, a frame per tick", async () => {
        const labelRef = createRef<Gtk.Label>();
        const counters: number[] = [];
        await render(<Fade labelRef={labelRef} counters={counters} duration={300} />, ANIMATED);
        await expectSettled(labelRef, 3000);
        expectClockDriven(counters, counters.length, 300);
    });

    it("stays on the frame clock across a long block of the main loop", async () => {
        const labelRef = createRef<Gtk.Label>();
        const counters: number[] = [];
        const stamps: number[] = [];
        await render(<Fade labelRef={labelRef} counters={counters} duration={1500} stamps={stamps} />, ANIMATED);

        await waitFor(() => {
            expect(labelRef.current?.getOpacity()).toBeGreaterThan(0);
        });

        blockMainLoopSoon(0, 400);
        const blockedAt = performance.now();
        await expectSettled(labelRef, 5000);
        expectClockDriven(counters, countBetween(stamps, blockedAt + 400, blockedAt + 1400), 1000);
    });

    it("moves to another window's frame clock as soon as the driving window goes away", async () => {
        const labelRef = createRef<Gtk.Label>();
        const counters: number[] = [];
        const stamps: number[] = [];

        const { rerender } = await render(
            <Fade labelRef={labelRef} counters={counters} duration={1500} to={0} stamps={stamps} />,
            ANIMATED,
        );

        const driver = await presentExtraWindow();
        expect(Gtk.Window.listToplevels()[0]).toBe(driver);
        await rerender(<Fade labelRef={labelRef} counters={counters} duration={1500} to={1} stamps={stamps} />);

        await waitFor(() => {
            expect(labelRef.current?.getOpacity()).toBeGreaterThan(0);
        });

        const destroyedAt = performance.now();
        driver.destroy();
        await expectSettled(labelRef, 5000);
        const resumedAt = stamps.find((stamp) => stamp > destroyedAt) ?? Infinity;
        expect(resumedAt - destroyedAt).toBeLessThan(STALL_GAP_MS);
    });
});

describe("frames - without a frame clock", () => {
    it("paces frames with a timer when no window is mapped", async () => {
        const labelRef = createRef<Gtk.Label>();
        const counters: number[] = [];

        await render(<Fade labelRef={labelRef} counters={counters} duration={300} />, {
            ...ANIMATED,
            container: new Gtk.Box(),
        });

        expect(labelRef.current?.getFrameClock()).toBeNull();
        await expectSettled(labelRef, 3000);
        expect(counters.length).toBeGreaterThan(1);
        expect(counters.length).toBeLessThan(CLOCK_SPEEDUP * timerFrames(300));
        expect(new Set(counters)).toEqual(new Set([-1]));
    });
});
