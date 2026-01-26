import * as Adw from "@gtkx/ffi/adw";
import type * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkButton, GtkLabel, x } from "@gtkx/react";
import { render, screen, waitFor } from "@gtkx/testing";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";

describe("x.Animation", () => {
    describe("mount animation", () => {
        it("applies initial values when animateOnMount is false", async () => {
            const buttonRef = createRef<Gtk.Button>();

            await render(
                <x.Animation mode="timed" initial={{ opacity: 0.5 }} animate={{ opacity: 1 }} animateOnMount={false}>
                    <GtkButton ref={buttonRef} label="Test" />
                </x.Animation>,
            );

            await screen.findByText("Test");
            expect(buttonRef.current).toBeDefined();
        });

        it("applies animate values directly when initial is false", async () => {
            const buttonRef = createRef<Gtk.Button>();

            await render(
                <x.Animation mode="timed" initial={false} animate={{ opacity: 1, scale: 1 }}>
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
                    mode="timed"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 100 }}
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
                        mode="timed"
                        animate={{ opacity: targetOpacity }}
                        transition={{ duration: 100 }}
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
                                mode="timed"
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 100 }}
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
                    mode="spring"
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
                    mode="spring"
                    initial={{ translateX: -100 }}
                    animate={{ translateX: 0 }}
                    transition={{ damping: 1, stiffness: 200, mass: 1 }}
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
                    mode="timed"
                    initial={{ rotate: 0 }}
                    animate={{ rotate: 360 }}
                    transition={{ duration: 100, easing: Adw.Easing.EASE_IN_OUT_CUBIC }}
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
                    mode="timed"
                    initial={{ opacity: 0, scale: 0.5, translateY: 50 }}
                    animate={{ opacity: 1, scale: 1, translateY: 0 }}
                    transition={{ duration: 100 }}
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
                    mode="timed"
                    initial={{ skewX: 0, skewY: 0 }}
                    animate={{ skewX: 10, skewY: 5 }}
                    transition={{ duration: 100 }}
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
});
