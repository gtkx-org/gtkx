import { CallbackAnimationTarget, TimedAnimation } from "@gtkx/ffi/adw";
import type * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkLabel, x } from "@gtkx/react";
import { render, tick, waitFor } from "@gtkx/testing";
import { createRef, useEffect, useRef } from "react";
import { describe, expect, it, vi } from "vitest";

describe("render - Animation", () => {
    describe("Direct animation API", () => {
        it("creates and runs a simple timed animation", async () => {
            const _labelRef = createRef<Gtk.Label>();
            const values: number[] = [];

            function App() {
                const ref = useRef<Gtk.Label>(null);

                useEffect(() => {
                    const label = ref.current;
                    if (!label) return;

                    const target = new CallbackAnimationTarget((value) => {
                        values.push(value);
                        label.setOpacity(value);
                    });

                    const animation = new TimedAnimation(label, 0, 1, 100, target);
                    animation.play();

                    return () => {
                        animation.reset();
                    };
                }, []);

                return (
                    <GtkBox>
                        <GtkLabel ref={ref} label="Test" />
                    </GtkBox>
                );
            }

            await render(<App />);

            await waitFor(
                () => {
                    expect(values.length).toBeGreaterThan(0);
                },
                { timeout: 500 },
            );
        });
    });

    describe("AnimationNode", () => {
        it("applies initial properties immediately", async () => {
            const labelRef = createRef<Gtk.Label>();

            await render(
                <GtkBox>
                    <x.Animation initial={{ opacity: 0.5 }}>
                        <GtkLabel ref={labelRef} label="Animated" />
                    </x.Animation>
                </GtkBox>,
            );

            await tick();
            expect(labelRef.current?.getOpacity()).toBeCloseTo(0.5, 1);
        });

        it("applies initial margin properties", async () => {
            const labelRef = createRef<Gtk.Label>();

            await render(
                <GtkBox>
                    <x.Animation initial={{ marginTop: 10, marginBottom: 20 }}>
                        <GtkLabel ref={labelRef} label="Animated" />
                    </x.Animation>
                </GtkBox>,
            );

            await tick();
            expect(labelRef.current?.getMarginTop()).toBe(10);
            expect(labelRef.current?.getMarginBottom()).toBe(20);
        });

        it("animates to target values with timed animation", async () => {
            const labelRef = createRef<Gtk.Label>();
            const values: number[] = [];

            function App() {
                return (
                    <GtkBox>
                        <x.Animation
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 100 }}
                            onAnimationComplete={() => values.push(-1)}
                        >
                            <GtkLabel ref={labelRef} label="Animated" />
                        </x.Animation>
                    </GtkBox>
                );
            }

            await render(<App />);

            await waitFor(
                () => {
                    expect(values).toContain(-1);
                },
                { timeout: 500 },
            );

            expect(labelRef.current?.getOpacity()).toBeCloseTo(1, 1);
        });

        it("animates with spring physics", async () => {
            const labelRef = createRef<Gtk.Label>();

            await render(
                <GtkBox>
                    <x.Animation
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ type: "spring", stiffness: 100, damping: 10 }}
                    >
                        <GtkLabel ref={labelRef} label="Animated" />
                    </x.Animation>
                </GtkBox>,
            );

            await waitFor(
                () => {
                    expect(labelRef.current?.getOpacity()).toBeCloseTo(1, 1);
                },
                { timeout: 1000 },
            );
        });

        it("calls onAnimationComplete when animation finishes", async () => {
            const labelRef = createRef<Gtk.Label>();
            const onComplete = vi.fn();

            await render(
                <GtkBox>
                    <x.Animation
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 50 }}
                        onAnimationComplete={onComplete}
                    >
                        <GtkLabel ref={labelRef} label="Animated" />
                    </x.Animation>
                </GtkBox>,
            );

            await waitFor(
                () => {
                    expect(onComplete).toHaveBeenCalled();
                },
                { timeout: 500 },
            );
        });

        it("removes animation wrapper without affecting child", async () => {
            const labelRef = createRef<Gtk.Label>();
            const boxRef = createRef<Gtk.Box>();

            function App({ showAnimation }: { showAnimation: boolean }) {
                return (
                    <GtkBox ref={boxRef}>
                        {showAnimation ? (
                            <x.Animation initial={{ opacity: 1 }}>
                                <GtkLabel ref={labelRef} label="Animated" />
                            </x.Animation>
                        ) : (
                            <GtkLabel label="Static" />
                        )}
                    </GtkBox>
                );
            }

            await render(<App showAnimation={true} />);
            await tick();

            expect(labelRef.current).not.toBeNull();

            await render(<App showAnimation={false} />);
            await tick();

            let childCount = 0;
            let child = boxRef.current?.getFirstChild();
            while (child) {
                childCount++;
                child = child.getNextSibling();
            }
            expect(childCount).toBe(1);
        });

        it("animates multiple properties simultaneously", async () => {
            const labelRef = createRef<Gtk.Label>();

            await render(
                <GtkBox>
                    <x.Animation
                        initial={{ opacity: 0, marginTop: 0 }}
                        animate={{ opacity: 1, marginTop: 20 }}
                        transition={{ duration: 100 }}
                    >
                        <GtkLabel ref={labelRef} label="Animated" />
                    </x.Animation>
                </GtkBox>,
            );

            await waitFor(
                () => {
                    expect(labelRef.current?.getOpacity()).toBeCloseTo(1, 1);
                    expect(labelRef.current?.getMarginTop()).toBe(20);
                },
                { timeout: 500 },
            );
        });

        it("restarts animation when animate prop changes", async () => {
            const labelRef = createRef<Gtk.Label>();

            function App({ targetOpacity }: { targetOpacity: number }) {
                return (
                    <GtkBox>
                        <x.Animation
                            initial={{ opacity: 0 }}
                            animate={{ opacity: targetOpacity }}
                            transition={{ duration: 50 }}
                        >
                            <GtkLabel ref={labelRef} label="Animated" />
                        </x.Animation>
                    </GtkBox>
                );
            }

            await render(<App targetOpacity={1} />);

            await waitFor(
                () => {
                    expect(labelRef.current?.getOpacity()).toBeCloseTo(1, 1);
                },
                { timeout: 500 },
            );

            await render(<App targetOpacity={0.5} />);

            await waitFor(
                () => {
                    expect(labelRef.current?.getOpacity()).toBeCloseTo(0.5, 1);
                },
                { timeout: 500 },
            );
        });
    });
});
