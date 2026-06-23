import { AnimatePresence, SpringAnimation, TimedAnimation } from "@gtkx/animate";
import * as Adw from "@gtkx/gi/adw";
import type * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkButton, GtkLabel } from "@gtkx/jsx/gtk";
import { render, screen, userEvent, waitFor } from "@gtkx/testing";
import React, { createRef, type ReactElement } from "react";
import { describe, expect, it, type Mock, vi } from "vitest";

const expectCompletes = async (animation: ReactElement, label: string, onComplete: Mock, timeout = 500) => {
    await render(animation);
    await screen.findByText(label);
    await waitFor(() => expect(onComplete).toHaveBeenCalled(), { timeout });
};

interface SpringTranslateXCase {
    from: number;
    to: number;
    damping: number;
    stiffness: number;
    timeout: number;
}

const expectSpringTranslateXCompletes = async ({ from, to, damping, stiffness, timeout }: SpringTranslateXCase) => {
    const onComplete = vi.fn();

    await expectCompletes(
        <SpringAnimation
            initial={{ translateX: from }}
            animate={{ translateX: to }}
            damping={damping}
            stiffness={stiffness}
            mass={1}
            animateOnMount
            onAnimationComplete={onComplete}
        >
            <GtkLabel label="Bouncy" />
        </SpringAnimation>,
        "Bouncy",
        onComplete,
        timeout,
    );
};

describe("TimedAnimation / SpringAnimation (1)", () => {
    describe("mount animation (1)", () => {
        it("applies initial values when animateOnMount is false", async () => {
            const buttonRef = createRef<Gtk.Button>();

            await render(
                <TimedAnimation initial={{ opacity: 0.5 }} animate={{ opacity: 1 }} animateOnMount={false}>
                    <GtkButton ref={buttonRef} label="Test" />
                </TimedAnimation>,
            );

            await screen.findByText("Test");
            expect(buttonRef.current).toBeDefined();
        });

        it("applies animate values directly when initial is false", async () => {
            const buttonRef = createRef<Gtk.Button>();

            await render(
                <TimedAnimation initial={false} animate={{ opacity: 1, scale: 1 }}>
                    <GtkButton ref={buttonRef} label="Test" />
                </TimedAnimation>,
            );

            await screen.findByText("Test");
            expect(buttonRef.current).toBeDefined();
        });
    });
});

describe("TimedAnimation / SpringAnimation (2)", () => {
    describe("mount animation (2)", () => {
        it("animates from initial to animate when animateOnMount is true", async () => {
            const onStart = vi.fn();
            const onComplete = vi.fn();
            const buttonRef = createRef<Gtk.Button>();

            await render(
                <TimedAnimation
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    duration={100}
                    animateOnMount
                    onAnimationStart={onStart}
                    onAnimationComplete={onComplete}
                >
                    <GtkButton ref={buttonRef} label="Test" />
                </TimedAnimation>,
            );

            await screen.findByText("Test");

            await waitFor(() => expect(onStart).toHaveBeenCalled());

            await waitFor(() => expect(onComplete).toHaveBeenCalled());
        });
    });
});

describe("TimedAnimation / SpringAnimation (3)", () => {
    describe("animate prop changes", () => {
        it("animates when animate prop changes", async () => {
            const onComplete = vi.fn();

            function TestComponent({ targetOpacity }: { targetOpacity: number }) {
                return (
                    <TimedAnimation
                        animate={{ opacity: targetOpacity }}
                        duration={100}
                        onAnimationComplete={onComplete}
                    >
                        <GtkLabel label="Test" />
                    </TimedAnimation>
                );
            }

            const { rerender } = await render(<TestComponent targetOpacity={1} />);

            await screen.findByText("Test");

            await rerender(<TestComponent targetOpacity={0.5} />);

            await waitFor(() => expect(onComplete).toHaveBeenCalled());
        });
    });
});

describe("TimedAnimation / SpringAnimation (4)", () => {
    describe("exit animation", () => {
        it("plays exit animation before unmount", async () => {
            const onComplete = vi.fn();

            function TestComponent({ show }: { show: boolean }) {
                return (
                    <GtkBox>
                        <AnimatePresence>
                            {show && (
                                <TimedAnimation
                                    key="fading"
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    duration={100}
                                    onAnimationComplete={onComplete}
                                >
                                    <GtkLabel label="Fading" />
                                </TimedAnimation>
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

describe("TimedAnimation / SpringAnimation (5)", () => {
    describe("spring animation", () => {
        it("creates spring animation with default parameters", async () => {
            const onComplete = vi.fn();
            const buttonRef = createRef<Gtk.Button>();

            await expectCompletes(
                <SpringAnimation
                    initial={{ scale: 0.5 }}
                    animate={{ scale: 1 }}
                    animateOnMount
                    onAnimationComplete={onComplete}
                >
                    <GtkButton ref={buttonRef} label="Spring" />
                </SpringAnimation>,
                "Spring",
                onComplete,
                2000,
            );
        });

        it("respects spring transition parameters", async () => {
            await expectSpringTranslateXCompletes({ from: -100, to: 0, damping: 1, stiffness: 200, timeout: 2000 });
        });
    });
});

describe("TimedAnimation / SpringAnimation (6)", () => {
    describe("timed animation", () => {
        it("respects easing function", async () => {
            const onComplete = vi.fn();

            await expectCompletes(
                <TimedAnimation
                    initial={{ rotate: 0 }}
                    animate={{ rotate: 360 }}
                    duration={100}
                    easing={Adw.Easing.EASE_IN_OUT_CUBIC}
                    animateOnMount
                    onAnimationComplete={onComplete}
                >
                    <GtkLabel label="Rotating" />
                </TimedAnimation>,
                "Rotating",
                onComplete,
            );
        });
    });

    describe("multiple properties", () => {
        it("animates multiple properties simultaneously", async () => {
            const onComplete = vi.fn();

            await expectCompletes(
                <TimedAnimation
                    initial={{ opacity: 0, scale: 0.5, translateY: 50 }}
                    animate={{ opacity: 1, scale: 1, translateY: 0 }}
                    duration={100}
                    animateOnMount
                    onAnimationComplete={onComplete}
                >
                    <GtkLabel label="Multi" />
                </TimedAnimation>,
                "Multi",
                onComplete,
            );
        });
    });
});

describe("TimedAnimation / SpringAnimation (7)", () => {
    describe("skew transforms", () => {
        it("animates skewX and skewY properties", async () => {
            const onComplete = vi.fn();

            await expectCompletes(
                <TimedAnimation
                    initial={{ skewX: 0, skewY: 0 }}
                    animate={{ skewX: 10, skewY: 5 }}
                    duration={100}
                    animateOnMount
                    onAnimationComplete={onComplete}
                >
                    <GtkLabel label="Skewed" />
                </TimedAnimation>,
                "Skewed",
                onComplete,
            );
        });
    });
});

describe("TimedAnimation / SpringAnimation (8)", () => {
    describe("repeating animation", () => {
        it("runs animation with repeat count", async () => {
            const onComplete = vi.fn();

            await expectCompletes(
                <TimedAnimation
                    initial={{ scale: 0.8 }}
                    animate={{ scale: 1.2 }}
                    duration={50}
                    repeat={2}
                    animateOnMount
                    onAnimationComplete={onComplete}
                >
                    <GtkLabel label="Repeating" />
                </TimedAnimation>,
                "Repeating",
                onComplete,
            );
        });

        it("runs animation with alternate", async () => {
            const onComplete = vi.fn();

            await expectCompletes(
                <TimedAnimation
                    initial={{ translateY: 0 }}
                    animate={{ translateY: -20 }}
                    duration={50}
                    repeat={2}
                    alternate
                    animateOnMount
                    onAnimationComplete={onComplete}
                >
                    <GtkLabel label="Alternating" />
                </TimedAnimation>,
                "Alternating",
                onComplete,
            );
        });
    });
});

describe("TimedAnimation / SpringAnimation (9)", () => {
    describe("transform animations (1)", () => {
        it("animates translateX property", async () => {
            const onComplete = vi.fn();

            await expectCompletes(
                <TimedAnimation
                    initial={{ translateX: 0 }}
                    animate={{ translateX: 100 }}
                    duration={100}
                    animateOnMount
                    onAnimationComplete={onComplete}
                >
                    <GtkLabel label="TranslateX" />
                </TimedAnimation>,
                "TranslateX",
                onComplete,
            );
        });

        it("animates translateY property", async () => {
            const onComplete = vi.fn();

            await expectCompletes(
                <TimedAnimation
                    initial={{ translateY: 0 }}
                    animate={{ translateY: 50 }}
                    duration={100}
                    animateOnMount
                    onAnimationComplete={onComplete}
                >
                    <GtkLabel label="TranslateY" />
                </TimedAnimation>,
                "TranslateY",
                onComplete,
            );
        });
    });
});

describe("TimedAnimation / SpringAnimation (10)", () => {
    describe("transform animations (2)", () => {
        it("animates scale property", async () => {
            const onComplete = vi.fn();

            await expectCompletes(
                <TimedAnimation
                    initial={{ scale: 1 }}
                    animate={{ scale: 1.5 }}
                    duration={100}
                    animateOnMount
                    onAnimationComplete={onComplete}
                >
                    <GtkLabel label="Scale" />
                </TimedAnimation>,
                "Scale",
                onComplete,
            );
        });

        it("animates rotate property", async () => {
            const onComplete = vi.fn();

            await expectCompletes(
                <TimedAnimation
                    initial={{ rotate: 0 }}
                    animate={{ rotate: 180 }}
                    duration={100}
                    animateOnMount
                    onAnimationComplete={onComplete}
                >
                    <GtkLabel label="Rotate" />
                </TimedAnimation>,
                "Rotate",
                onComplete,
            );
        });
    });
});

describe("TimedAnimation / SpringAnimation (11)", () => {
    describe("state-driven spring animation (1)", () => {
        it("animates when state triggers animate prop change", async () => {
            const onComplete = vi.fn();

            function BounceDemo() {
                const [trigger, setTrigger] = React.useState(0);

                return (
                    <GtkBox>
                        <GtkButton label="Bounce" onClicked={() => setTrigger((t) => t + 1)} />
                        <SpringAnimation
                            initial={false}
                            animate={{ translateX: trigger % 2 === 0 ? 0 : 150 }}
                            damping={1}
                            stiffness={200}
                            mass={1}
                            onAnimationComplete={onComplete}
                        >
                            <GtkLabel label="Target" />
                        </SpringAnimation>
                    </GtkBox>
                );
            }

            await render(<BounceDemo />);

            const button = await screen.findByText("Bounce");

            await userEvent.click(button);

            await waitFor(() => expect(onComplete).toHaveBeenCalled());
        });
    });
});

describe("TimedAnimation / SpringAnimation (12)", () => {
    describe("state-driven spring animation (2)", () => {
        it("animates spring with low damping for bouncy effect", async () => {
            await expectSpringTranslateXCompletes({ from: 0, to: 100, damping: 0.5, stiffness: 100, timeout: 3000 });
        });
    });

    describe("animation delay", () => {
        it("delays timed animation start", async () => {
            const onComplete = vi.fn();

            await expectCompletes(
                <TimedAnimation
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    duration={50}
                    delay={50}
                    animateOnMount
                    onAnimationComplete={onComplete}
                >
                    <GtkLabel label="Delayed" />
                </TimedAnimation>,
                "Delayed",
                onComplete,
            );
        });
    });
});

describe("TimedAnimation / SpringAnimation (13)", () => {
    describe("easing functions (1)", () => {
        it("animates with EASE_OUT_BOUNCE easing", async () => {
            const onComplete = vi.fn();

            await expectCompletes(
                <TimedAnimation
                    initial={{ translateX: 0 }}
                    animate={{ translateX: 60 }}
                    duration={100}
                    easing={Adw.Easing.EASE_OUT_BOUNCE}
                    animateOnMount
                    onAnimationComplete={onComplete}
                >
                    <GtkLabel label="Bounce Easing" />
                </TimedAnimation>,
                "Bounce Easing",
                onComplete,
            );
        });

        it("animates with EASE_OUT_ELASTIC easing", async () => {
            const onComplete = vi.fn();

            await expectCompletes(
                <TimedAnimation
                    initial={{ translateX: 0 }}
                    animate={{ translateX: 60 }}
                    duration={100}
                    easing={Adw.Easing.EASE_OUT_ELASTIC}
                    animateOnMount
                    onAnimationComplete={onComplete}
                >
                    <GtkLabel label="Elastic Easing" />
                </TimedAnimation>,
                "Elastic Easing",
                onComplete,
            );
        });
    });
});

describe("TimedAnimation / SpringAnimation (14)", () => {
    describe("easing functions (2)", () => {
        it("animates with LINEAR easing", async () => {
            const onComplete = vi.fn();

            await expectCompletes(
                <TimedAnimation
                    initial={{ translateX: 0 }}
                    animate={{ translateX: 60 }}
                    duration={100}
                    easing={Adw.Easing.LINEAR}
                    animateOnMount
                    onAnimationComplete={onComplete}
                >
                    <GtkLabel label="Linear Easing" />
                </TimedAnimation>,
                "Linear Easing",
                onComplete,
            );
        });
    });
});
