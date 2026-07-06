import { AnimatePresence, animated } from "@gtkx/animate";
import type * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkButton } from "@gtkx/jsx/gtk";
import { render as baseRender, screen, userEvent, waitFor } from "@gtkx/testing";
import React, { createRef, type ReactElement, type ReactNode } from "react";
import { describe, expect, it, type Mock, vi } from "vitest";

const render = (element: ReactNode) => baseRender(element, { animations: true });

const expectCompletes = async (animation: ReactElement, label: string, onComplete: Mock, timeout = 500) => {
    await render(animation);
    await screen.findByText(label);
    await waitFor(() => expect(onComplete).toHaveBeenCalled(), { timeout });
};

interface SpringXCase {
    from: number;
    to: number;
    damping: number;
    stiffness: number;
    timeout: number;
}

const expectSpringXCompletes = async ({ from, to, damping, stiffness, timeout }: SpringXCase) => {
    const onComplete = vi.fn();

    await expectCompletes(
        <animated.GtkLabel
            label="Bouncy"
            initial={{ x: from }}
            animate={{ x: to }}
            transition={{ type: "spring", damping, stiffness, mass: 1 }}
            onAnimationComplete={onComplete}
        />,
        "Bouncy",
        onComplete,
        timeout,
    );
};

describe("animated (1)", () => {
    describe("mount animation (1)", () => {
        it("applies initial values when no animate target is set", async () => {
            const buttonRef = createRef<Gtk.Button>();

            await render(<animated.GtkButton ref={buttonRef} label="Test" initial={{ opacity: 0.5 }} />);

            await screen.findByText("Test");
            expect(buttonRef.current).toBeDefined();
        });

        it("applies animate values directly when initial is false", async () => {
            const buttonRef = createRef<Gtk.Button>();

            await render(
                <animated.GtkButton ref={buttonRef} label="Test" initial={false} animate={{ opacity: 1, scale: 1 }} />,
            );

            await screen.findByText("Test");
            expect(buttonRef.current).toBeDefined();
        });
    });
});

describe("animated (2)", () => {
    describe("mount animation (2)", () => {
        it("animates from initial to animate on mount", async () => {
            const onStart = vi.fn();
            const onComplete = vi.fn();
            const buttonRef = createRef<Gtk.Button>();

            await render(
                <animated.GtkButton
                    ref={buttonRef}
                    label="Test"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.1 }}
                    onAnimationStart={onStart}
                    onAnimationComplete={onComplete}
                />,
            );

            await screen.findByText("Test");

            await waitFor(() => expect(onStart).toHaveBeenCalled());

            await waitFor(() => expect(onComplete).toHaveBeenCalled());
        });
    });
});

describe("animated (3)", () => {
    describe("animate prop changes", () => {
        it("animates when animate prop changes", async () => {
            const onComplete = vi.fn();

            function TestComponent({ targetOpacity }: { targetOpacity: number }) {
                return (
                    <animated.GtkLabel
                        label="Test"
                        animate={{ opacity: targetOpacity }}
                        transition={{ duration: 0.1 }}
                        onAnimationComplete={onComplete}
                    />
                );
            }

            const { rerender } = await render(<TestComponent targetOpacity={1} />);

            await screen.findByText("Test");

            await rerender(<TestComponent targetOpacity={0.5} />);

            await waitFor(() => expect(onComplete).toHaveBeenCalled());
        });
    });
});

describe("animated (4)", () => {
    describe("exit animation", () => {
        it("plays exit animation before unmount", async () => {
            const onComplete = vi.fn();

            function TestComponent({ show }: { show: boolean }) {
                return (
                    <GtkBox>
                        <AnimatePresence>
                            {show && (
                                <animated.GtkLabel
                                    key="fading"
                                    label="Fading"
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    transition={{ duration: 0.1 }}
                                    onAnimationComplete={onComplete}
                                />
                            )}
                        </AnimatePresence>
                    </GtkBox>
                );
            }

            const { rerender } = await render(<TestComponent show={true} />);

            await screen.findByText("Fading");

            await rerender(<TestComponent show={false} />);

            await waitFor(() => expect(onComplete).toHaveBeenCalled());

            await waitFor(() => expect(screen.queryByText("Fading")).toBeNull());
        });
    });
});

describe("animated (5)", () => {
    describe("spring animation", () => {
        it("creates spring animation with default parameters", async () => {
            const onComplete = vi.fn();
            const buttonRef = createRef<Gtk.Button>();

            await expectCompletes(
                <animated.GtkButton
                    ref={buttonRef}
                    label="Spring"
                    initial={{ scale: 0.5 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring" }}
                    onAnimationComplete={onComplete}
                />,
                "Spring",
                onComplete,
                2000,
            );
        });

        it("respects spring transition parameters", async () => {
            await expectSpringXCompletes({ from: -100, to: 0, damping: 1, stiffness: 200, timeout: 2000 });
        });
    });
});

describe("animated (6)", () => {
    describe("timed animation", () => {
        it("respects easing function", async () => {
            const onComplete = vi.fn();

            await expectCompletes(
                <animated.GtkLabel
                    label="Rotating"
                    initial={{ rotate: 0 }}
                    animate={{ rotate: 360 }}
                    transition={{ duration: 0.1, ease: "easeInOut" }}
                    onAnimationComplete={onComplete}
                />,
                "Rotating",
                onComplete,
            );
        });
    });

    describe("multiple properties", () => {
        it("animates multiple properties simultaneously", async () => {
            const onComplete = vi.fn();

            await expectCompletes(
                <animated.GtkLabel
                    label="Multi"
                    initial={{ opacity: 0, scale: 0.5, y: 50 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ duration: 0.1 }}
                    onAnimationComplete={onComplete}
                />,
                "Multi",
                onComplete,
            );
        });
    });
});

describe("animated (7)", () => {
    describe("skew transforms", () => {
        it("animates skewX and skewY properties", async () => {
            const onComplete = vi.fn();

            await expectCompletes(
                <animated.GtkLabel
                    label="Skewed"
                    initial={{ skewX: 0, skewY: 0 }}
                    animate={{ skewX: 10, skewY: 5 }}
                    transition={{ duration: 0.1 }}
                    onAnimationComplete={onComplete}
                />,
                "Skewed",
                onComplete,
            );
        });
    });
});

describe("animated (8)", () => {
    describe("repeating animation", () => {
        it("runs animation with repeat count", async () => {
            const onComplete = vi.fn();

            await expectCompletes(
                <animated.GtkLabel
                    label="Repeating"
                    initial={{ scale: 0.8 }}
                    animate={{ scale: 1.2 }}
                    transition={{ duration: 0.05, repeat: 2 }}
                    onAnimationComplete={onComplete}
                />,
                "Repeating",
                onComplete,
            );
        });

        it("runs animation with reverse repeat type", async () => {
            const onComplete = vi.fn();

            await expectCompletes(
                <animated.GtkLabel
                    label="Alternating"
                    initial={{ y: 0 }}
                    animate={{ y: -20 }}
                    transition={{ duration: 0.05, repeat: 2, repeatType: "reverse" }}
                    onAnimationComplete={onComplete}
                />,
                "Alternating",
                onComplete,
            );
        });
    });
});

describe("animated (9)", () => {
    describe("transform animations (1)", () => {
        it("animates x property", async () => {
            const onComplete = vi.fn();

            await expectCompletes(
                <animated.GtkLabel
                    label="TranslateX"
                    initial={{ x: 0 }}
                    animate={{ x: 100 }}
                    transition={{ duration: 0.1 }}
                    onAnimationComplete={onComplete}
                />,
                "TranslateX",
                onComplete,
            );
        });

        it("animates y property", async () => {
            const onComplete = vi.fn();

            await expectCompletes(
                <animated.GtkLabel
                    label="TranslateY"
                    initial={{ y: 0 }}
                    animate={{ y: 50 }}
                    transition={{ duration: 0.1 }}
                    onAnimationComplete={onComplete}
                />,
                "TranslateY",
                onComplete,
            );
        });
    });
});

describe("animated (10)", () => {
    describe("transform animations (2)", () => {
        it("animates scale property", async () => {
            const onComplete = vi.fn();

            await expectCompletes(
                <animated.GtkLabel
                    label="Scale"
                    initial={{ scale: 1 }}
                    animate={{ scale: 1.5 }}
                    transition={{ duration: 0.1 }}
                    onAnimationComplete={onComplete}
                />,
                "Scale",
                onComplete,
            );
        });

        it("animates rotate property", async () => {
            const onComplete = vi.fn();

            await expectCompletes(
                <animated.GtkLabel
                    label="Rotate"
                    initial={{ rotate: 0 }}
                    animate={{ rotate: 180 }}
                    transition={{ duration: 0.1 }}
                    onAnimationComplete={onComplete}
                />,
                "Rotate",
                onComplete,
            );
        });
    });
});

describe("animated (11)", () => {
    describe("state-driven spring animation (1)", () => {
        it("animates when state triggers animate prop change", async () => {
            const onComplete = vi.fn();

            function BounceDemo() {
                const [trigger, setTrigger] = React.useState(0);

                return (
                    <GtkBox>
                        <GtkButton label="Bounce" onClicked={() => setTrigger((t) => t + 1)} />
                        <animated.GtkLabel
                            label="Target"
                            initial={false}
                            animate={{ x: trigger % 2 === 0 ? 0 : 150 }}
                            transition={{ type: "spring", damping: 28, stiffness: 200, mass: 1 }}
                            onAnimationComplete={onComplete}
                        />
                    </GtkBox>
                );
            }

            await render(<BounceDemo />);

            const button = await screen.findByText("Bounce");

            await userEvent.click(button);

            await waitFor(() => expect(onComplete).toHaveBeenCalled(), { timeout: 2000 });
        });
    });
});

describe("animated (12)", () => {
    describe("state-driven spring animation (2)", () => {
        it("animates spring with low damping for bouncy effect", async () => {
            await expectSpringXCompletes({ from: 0, to: 100, damping: 0.5, stiffness: 100, timeout: 3000 });
        });
    });

    describe("animation delay", () => {
        it("delays timed animation start", async () => {
            const onComplete = vi.fn();

            await expectCompletes(
                <animated.GtkLabel
                    label="Delayed"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.05, delay: 0.05 }}
                    onAnimationComplete={onComplete}
                />,
                "Delayed",
                onComplete,
            );
        });
    });
});

describe("animated (13)", () => {
    describe("easing functions (1)", () => {
        it("animates with easeOut easing", async () => {
            const onComplete = vi.fn();

            await expectCompletes(
                <animated.GtkLabel
                    label="Ease Out"
                    initial={{ x: 0 }}
                    animate={{ x: 60 }}
                    transition={{ duration: 0.1, ease: "easeOut" }}
                    onAnimationComplete={onComplete}
                />,
                "Ease Out",
                onComplete,
            );
        });

        it("animates with easeIn easing", async () => {
            const onComplete = vi.fn();

            await expectCompletes(
                <animated.GtkLabel
                    label="Ease In"
                    initial={{ x: 0 }}
                    animate={{ x: 60 }}
                    transition={{ duration: 0.1, ease: "easeIn" }}
                    onAnimationComplete={onComplete}
                />,
                "Ease In",
                onComplete,
            );
        });
    });
});

describe("animated (14)", () => {
    describe("easing functions (2)", () => {
        it("animates with linear easing", async () => {
            const onComplete = vi.fn();

            await expectCompletes(
                <animated.GtkLabel
                    label="Linear Easing"
                    initial={{ x: 0 }}
                    animate={{ x: 60 }}
                    transition={{ duration: 0.1, ease: "linear" }}
                    onAnimationComplete={onComplete}
                />,
                "Linear Easing",
                onComplete,
            );
        });
    });
});

describe("animated (15)", () => {
    describe("shallow-equal animate guard", () => {
        it("does not re-animate when the animate target is shallow-equal across renders", async () => {
            const onAnimationStart = vi.fn();

            function App({ tick }: { tick: number }) {
                return (
                    <GtkBox>
                        <GtkButton label={`tick-${tick}`} />
                        <animated.GtkLabel
                            label="Stable"
                            initial={false}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.05 }}
                            onAnimationStart={onAnimationStart}
                        />
                    </GtkBox>
                );
            }

            const { rerender } = await render(<App tick={0} />);
            await screen.findByText("Stable");
            onAnimationStart.mockClear();

            await rerender(<App tick={1} />);
            await rerender(<App tick={2} />);

            expect(onAnimationStart).not.toHaveBeenCalled();
        });
    });
});
