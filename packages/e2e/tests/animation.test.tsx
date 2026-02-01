import * as Adw from "@gtkx/ffi/adw";
import type * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkButton, GtkLabel, x } from "@gtkx/react";
import { render, screen, userEvent, waitFor } from "@gtkx/testing";
import React, { createRef } from "react";
import { describe, expect, it, vi } from "vitest";

describe("x.Animation", () => {
    describe("mount animation", () => {
        it("applies initial values when animateOnMount is false", async () => {
            const buttonRef = createRef<Gtk.Button>();

            await render(
                <x.Animation
                    transition={{ mode: "timed" }}
                    initial={{ opacity: 0.5 }}
                    animate={{ opacity: 1 }}
                    animateOnMount={false}
                >
                    <GtkButton ref={buttonRef} label="Test" />
                </x.Animation>,
            );

            await screen.findByText("Test");
            expect(buttonRef.current).toBeDefined();
        });

        it("applies animate values directly when initial is false", async () => {
            const buttonRef = createRef<Gtk.Button>();

            await render(
                <x.Animation transition={{ mode: "timed" }} initial={false} animate={{ opacity: 1, scale: 1 }}>
                    <GtkButton ref={buttonRef} label="Test" />
                </x.Animation>,
            );

            await screen.findByText("Test");
            expect(buttonRef.current).toBeDefined();
        });

        it("animates from initial to animate when animateOnMount is true", async () => {
            const onStart = vi.fn();
            const onComplete = vi.fn();
            const buttonRef = createRef<Gtk.Button>();

            await render(
                <x.Animation
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ mode: "timed", duration: 100 }}
                    animateOnMount
                    onAnimationStart={onStart}
                    onAnimationComplete={onComplete}
                >
                    <GtkButton ref={buttonRef} label="Test" />
                </x.Animation>,
            );

            await screen.findByText("Test");

            await waitFor(() => expect(onStart).toHaveBeenCalled(), { timeout: 500 });

            await waitFor(() => expect(onComplete).toHaveBeenCalled(), { timeout: 500 });
        });
    });

    describe("animate prop changes", () => {
        it("animates when animate prop changes", async () => {
            const onComplete = vi.fn();

            function TestComponent({ targetOpacity }: { targetOpacity: number }) {
                return (
                    <x.Animation
                        animate={{ opacity: targetOpacity }}
                        transition={{ mode: "timed", duration: 100 }}
                        onAnimationComplete={onComplete}
                    >
                        <GtkLabel label="Test" />
                    </x.Animation>
                );
            }

            const { rerender } = await render(<TestComponent targetOpacity={1} />);

            await screen.findByText("Test");

            await rerender(<TestComponent targetOpacity={0.5} />);

            await waitFor(() => expect(onComplete).toHaveBeenCalled(), { timeout: 500 });
        });
    });

    describe("exit animation", () => {
        it("plays exit animation before unmount", async () => {
            const onComplete = vi.fn();

            function TestComponent({ show }: { show: boolean }) {
                return (
                    <GtkBox>
                        {show && (
                            <x.Animation
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ mode: "timed", duration: 100 }}
                                onAnimationComplete={onComplete}
                            >
                                <GtkLabel label="Fading" />
                            </x.Animation>
                        )}
                    </GtkBox>
                );
            }

            const { rerender } = await render(<TestComponent show={true} />);

            await screen.findByText("Fading");

            await rerender(<TestComponent show={false} />);

            await waitFor(() => expect(onComplete).toHaveBeenCalled(), { timeout: 500 });

            await waitFor(() => expect(screen.queryByText("Fading")).toBeNull(), { timeout: 500 });
        });
    });

    describe("spring animation", () => {
        it("creates spring animation with default parameters", async () => {
            const onComplete = vi.fn();
            const buttonRef = createRef<Gtk.Button>();

            await render(
                <x.Animation
                    transition={{ mode: "spring" }}
                    initial={{ scale: 0.5 }}
                    animate={{ scale: 1 }}
                    animateOnMount
                    onAnimationComplete={onComplete}
                >
                    <GtkButton ref={buttonRef} label="Spring" />
                </x.Animation>,
            );

            await screen.findByText("Spring");

            await waitFor(() => expect(onComplete).toHaveBeenCalled(), { timeout: 2000 });
        });

        it("respects spring transition parameters", async () => {
            const onComplete = vi.fn();

            await render(
                <x.Animation
                    initial={{ translateX: -100 }}
                    animate={{ translateX: 0 }}
                    transition={{ mode: "spring", damping: 1, stiffness: 200, mass: 1 }}
                    animateOnMount
                    onAnimationComplete={onComplete}
                >
                    <GtkLabel label="Bouncy" />
                </x.Animation>,
            );

            await screen.findByText("Bouncy");

            await waitFor(() => expect(onComplete).toHaveBeenCalled(), { timeout: 2000 });
        });
    });

    describe("timed animation", () => {
        it("respects easing function", async () => {
            const onComplete = vi.fn();

            await render(
                <x.Animation
                    initial={{ rotate: 0 }}
                    animate={{ rotate: 360 }}
                    transition={{ mode: "timed", duration: 100, easing: Adw.Easing.EASE_IN_OUT_CUBIC }}
                    animateOnMount
                    onAnimationComplete={onComplete}
                >
                    <GtkLabel label="Rotating" />
                </x.Animation>,
            );

            await screen.findByText("Rotating");

            await waitFor(() => expect(onComplete).toHaveBeenCalled(), { timeout: 500 });
        });
    });

    describe("multiple properties", () => {
        it("animates multiple properties simultaneously", async () => {
            const onComplete = vi.fn();

            await render(
                <x.Animation
                    initial={{ opacity: 0, scale: 0.5, translateY: 50 }}
                    animate={{ opacity: 1, scale: 1, translateY: 0 }}
                    transition={{ mode: "timed", duration: 100 }}
                    animateOnMount
                    onAnimationComplete={onComplete}
                >
                    <GtkLabel label="Multi" />
                </x.Animation>,
            );

            await screen.findByText("Multi");

            await waitFor(() => expect(onComplete).toHaveBeenCalled(), { timeout: 500 });
        });
    });

    describe("skew transforms", () => {
        it("animates skewX and skewY properties", async () => {
            const onComplete = vi.fn();

            await render(
                <x.Animation
                    initial={{ skewX: 0, skewY: 0 }}
                    animate={{ skewX: 10, skewY: 5 }}
                    transition={{ mode: "timed", duration: 100 }}
                    animateOnMount
                    onAnimationComplete={onComplete}
                >
                    <GtkLabel label="Skewed" />
                </x.Animation>,
            );

            await screen.findByText("Skewed");

            await waitFor(() => expect(onComplete).toHaveBeenCalled(), { timeout: 500 });
        });
    });

    describe("repeating animation", () => {
        it("runs animation with repeat count", async () => {
            const onComplete = vi.fn();

            await render(
                <x.Animation
                    initial={{ scale: 0.8 }}
                    animate={{ scale: 1.2 }}
                    transition={{ mode: "timed", duration: 50, repeat: 2 }}
                    animateOnMount
                    onAnimationComplete={onComplete}
                >
                    <GtkLabel label="Repeating" />
                </x.Animation>,
            );

            await screen.findByText("Repeating");

            await waitFor(() => expect(onComplete).toHaveBeenCalled(), { timeout: 500 });
        });

        it("runs animation with alternate", async () => {
            const onComplete = vi.fn();

            await render(
                <x.Animation
                    initial={{ translateY: 0 }}
                    animate={{ translateY: -20 }}
                    transition={{ mode: "timed", duration: 50, repeat: 2, alternate: true }}
                    animateOnMount
                    onAnimationComplete={onComplete}
                >
                    <GtkLabel label="Alternating" />
                </x.Animation>,
            );

            await screen.findByText("Alternating");

            await waitFor(() => expect(onComplete).toHaveBeenCalled(), { timeout: 500 });
        });
    });

    describe("transform animations", () => {
        it("animates translateX property", async () => {
            const onComplete = vi.fn();

            await render(
                <x.Animation
                    initial={{ translateX: 0 }}
                    animate={{ translateX: 100 }}
                    transition={{ mode: "timed", duration: 100 }}
                    animateOnMount
                    onAnimationComplete={onComplete}
                >
                    <GtkLabel label="TranslateX" />
                </x.Animation>,
            );

            await screen.findByText("TranslateX");

            await waitFor(() => expect(onComplete).toHaveBeenCalled(), { timeout: 500 });
        });

        it("animates translateY property", async () => {
            const onComplete = vi.fn();

            await render(
                <x.Animation
                    initial={{ translateY: 0 }}
                    animate={{ translateY: 50 }}
                    transition={{ mode: "timed", duration: 100 }}
                    animateOnMount
                    onAnimationComplete={onComplete}
                >
                    <GtkLabel label="TranslateY" />
                </x.Animation>,
            );

            await screen.findByText("TranslateY");

            await waitFor(() => expect(onComplete).toHaveBeenCalled(), { timeout: 500 });
        });

        it("animates scale property", async () => {
            const onComplete = vi.fn();

            await render(
                <x.Animation
                    initial={{ scale: 1 }}
                    animate={{ scale: 1.5 }}
                    transition={{ mode: "timed", duration: 100 }}
                    animateOnMount
                    onAnimationComplete={onComplete}
                >
                    <GtkLabel label="Scale" />
                </x.Animation>,
            );

            await screen.findByText("Scale");

            await waitFor(() => expect(onComplete).toHaveBeenCalled(), { timeout: 500 });
        });

        it("animates rotate property", async () => {
            const onComplete = vi.fn();

            await render(
                <x.Animation
                    initial={{ rotate: 0 }}
                    animate={{ rotate: 180 }}
                    transition={{ mode: "timed", duration: 100 }}
                    animateOnMount
                    onAnimationComplete={onComplete}
                >
                    <GtkLabel label="Rotate" />
                </x.Animation>,
            );

            await screen.findByText("Rotate");

            await waitFor(() => expect(onComplete).toHaveBeenCalled(), { timeout: 500 });
        });
    });

    describe("state-driven spring animation", () => {
        it("animates when state triggers animate prop change", async () => {
            const onComplete = vi.fn();

            function BounceDemo() {
                const [trigger, setTrigger] = React.useState(0);

                return (
                    <GtkBox>
                        <GtkButton label="Bounce" onClicked={() => setTrigger((t) => t + 1)} />
                        <x.Animation
                            initial={false}
                            animate={{ translateX: trigger % 2 === 0 ? 0 : 150 }}
                            transition={{ mode: "spring", damping: 1, stiffness: 200, mass: 1 }}
                            onAnimationComplete={onComplete}
                        >
                            <GtkLabel label="Target" />
                        </x.Animation>
                    </GtkBox>
                );
            }

            await render(<BounceDemo />);

            const button = await screen.findByText("Bounce");

            await userEvent.click(button);

            await waitFor(() => expect(onComplete).toHaveBeenCalled(), { timeout: 2000 });
        });

        it("animates spring with low damping for bouncy effect", async () => {
            const onComplete = vi.fn();

            await render(
                <x.Animation
                    initial={{ translateX: 0 }}
                    animate={{ translateX: 100 }}
                    transition={{ mode: "spring", damping: 0.5, stiffness: 100, mass: 1 }}
                    animateOnMount
                    onAnimationComplete={onComplete}
                >
                    <GtkLabel label="Bouncy" />
                </x.Animation>,
            );

            await screen.findByText("Bouncy");

            await waitFor(() => expect(onComplete).toHaveBeenCalled(), { timeout: 3000 });
        });
    });

    describe("animation delay", () => {
        it("delays timed animation start", async () => {
            const onComplete = vi.fn();

            await render(
                <x.Animation
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ mode: "timed", duration: 50, delay: 50 }}
                    animateOnMount
                    onAnimationComplete={onComplete}
                >
                    <GtkLabel label="Delayed" />
                </x.Animation>,
            );

            await screen.findByText("Delayed");

            await waitFor(() => expect(onComplete).toHaveBeenCalled(), { timeout: 500 });
        });
    });

    describe("easing functions", () => {
        it("animates with EASE_OUT_BOUNCE easing", async () => {
            const onComplete = vi.fn();

            await render(
                <x.Animation
                    initial={{ translateX: 0 }}
                    animate={{ translateX: 60 }}
                    transition={{ mode: "timed", duration: 100, easing: Adw.Easing.EASE_OUT_BOUNCE }}
                    animateOnMount
                    onAnimationComplete={onComplete}
                >
                    <GtkLabel label="Bounce Easing" />
                </x.Animation>,
            );

            await screen.findByText("Bounce Easing");

            await waitFor(() => expect(onComplete).toHaveBeenCalled(), { timeout: 500 });
        });

        it("animates with EASE_OUT_ELASTIC easing", async () => {
            const onComplete = vi.fn();

            await render(
                <x.Animation
                    initial={{ translateX: 0 }}
                    animate={{ translateX: 60 }}
                    transition={{ mode: "timed", duration: 100, easing: Adw.Easing.EASE_OUT_ELASTIC }}
                    animateOnMount
                    onAnimationComplete={onComplete}
                >
                    <GtkLabel label="Elastic Easing" />
                </x.Animation>,
            );

            await screen.findByText("Elastic Easing");

            await waitFor(() => expect(onComplete).toHaveBeenCalled(), { timeout: 500 });
        });

        it("animates with LINEAR easing", async () => {
            const onComplete = vi.fn();

            await render(
                <x.Animation
                    initial={{ translateX: 0 }}
                    animate={{ translateX: 60 }}
                    transition={{ mode: "timed", duration: 100, easing: Adw.Easing.LINEAR }}
                    animateOnMount
                    onAnimationComplete={onComplete}
                >
                    <GtkLabel label="Linear Easing" />
                </x.Animation>,
            );

            await screen.findByText("Linear Easing");

            await waitFor(() => expect(onComplete).toHaveBeenCalled(), { timeout: 500 });
        });
    });
});
