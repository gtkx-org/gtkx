import type { ReactNode, RefObject } from "react";
import { animated, useReducedMotion, useSpring } from "@gtkx/animated";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkButton, GtkLabel } from "@gtkx/jsx/gtk";
import { act, render, screen, userEvent, waitFor } from "@gtkx/testing";
import { createRef } from "react";
import { describe, expect, it } from "vitest";

type FadeProps = { labelRef: RefObject<Gtk.Label | null>; changes: number[] };

const ANIMATED = { areAnimationsEnabled: true };
const AnimatedButton = animated(GtkButton);
const AnimatedLabel = animated(GtkLabel);
const SLOW = { duration: 400 };
const HAS_REDUCED_MOTION_SETTING = Gtk.checkVersion(4, 22, 0) === null;

const Fade = ({ labelRef, changes }: FadeProps): ReactNode => {
    const styles = useSpring({
        from: { opacity: 0 },
        to: { opacity: 1 },
        config: SLOW,
        onChange: ({ value }) => {
            changes.push(value.opacity as number);
        },
    });

    return <AnimatedLabel ref={labelRef} opacity={styles.opacity} label="fade" />;
};

const Deferred = ({ labelRef, changes }: FadeProps): ReactNode => {
    const [styles, api] = useSpring(() => ({
        opacity: 0,
        onChange: ({ value }) => {
            changes.push(value.opacity as number);
        },
    }));

    return (
        <GtkBox>
            <AnimatedLabel ref={labelRef} opacity={styles.opacity} label="deferred" />
            <AnimatedButton label="Start" onClicked={() => api.start({ opacity: 1, config: SLOW })} />
        </GtkBox>
    );
};

const Probe = (): ReactNode => {
    const isReduced = useReducedMotion();

    return <GtkLabel>{String(isReduced)}</GtkLabel>;
};

const getSettings = (): Gtk.Settings => {
    const settings = Gtk.Settings.getDefault();

    if (settings === null) {
        throw new Error("expected a default display");
    }

    return settings;
};

const setAnimationsEnabled = (isEnabled: boolean): PromiseLike<void> =>
    act(() => {
        getSettings().gtkEnableAnimations = isEnabled;
    });

const setReducedMotion = (motion: Gtk.ReducedMotion): PromiseLike<void> =>
    act(() => {
        getSettings().gtkInterfaceReducedMotion = motion;
    });

const expectOpacity = (labelRef: RefObject<Gtk.Label | null>, opacity: number): Promise<void> =>
    waitFor(() => {
        expect(labelRef.current?.getOpacity()).toBe(opacity);
    });

describe("reduced motion - gtk-enable-animations", () => {
    it("jumps straight to the target while the desktop disables animations", async () => {
        const labelRef = createRef<Gtk.Label>();
        const changes: number[] = [];
        await render(<Fade labelRef={labelRef} changes={changes} />);
        await expectOpacity(labelRef, 1);
        expect(changes).toEqual([1]);
    });

    it("passes through intermediate values while the desktop enables animations", async () => {
        const labelRef = createRef<Gtk.Label>();
        const changes: number[] = [];
        await render(<Fade labelRef={labelRef} changes={changes} />, ANIMATED);
        await expectOpacity(labelRef, 1);
        expect(changes.length).toBeGreaterThan(1);
    });

    it("applies a change of the setting to the animations started afterwards", async () => {
        const labelRef = createRef<Gtk.Label>();
        const changes: number[] = [];
        await render(<Deferred labelRef={labelRef} changes={changes} />, ANIMATED);
        await setAnimationsEnabled(false);
        await userEvent.click(screen.getByRole(Gtk.AccessibleRole.BUTTON, { name: "Start" }));
        await expectOpacity(labelRef, 1);
        expect(changes).toEqual([1]);
    });
});

describe("reduced motion - useReducedMotion", () => {
    it("reports the setting and follows it while mounted", async () => {
        await render(<Probe />);
        expect(await screen.findByText("true")).toBeVisible();
        await setAnimationsEnabled(true);
        expect(await screen.findByText("false")).toBeVisible();
        await setAnimationsEnabled(false);
        expect(await screen.findByText("true")).toBeVisible();
    });

    it("reports that animations run when the test enables them", async () => {
        await render(<Probe />, ANIMATED);
        expect(await screen.findByText("false")).toBeVisible();
    });

    it.skipIf(!HAS_REDUCED_MOTION_SETTING)("reports the reduced-motion preference while springs run", async () => {
        const labelRef = createRef<Gtk.Label>();
        const changes: number[] = [];
        await setReducedMotion(Gtk.ReducedMotion.REDUCE);

        try {
            await render(
                <GtkBox>
                    <Probe />
                    <Fade labelRef={labelRef} changes={changes} />
                </GtkBox>,
                ANIMATED,
            );

            expect(await screen.findByText("true")).toBeVisible();
            await expectOpacity(labelRef, 1);
            expect(changes.length).toBeGreaterThan(1);
        } finally {
            await setReducedMotion(Gtk.ReducedMotion.NO_PREFERENCE);
        }
    });
});
