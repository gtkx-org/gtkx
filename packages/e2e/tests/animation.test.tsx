import * as Adw from "@gtkx/ffi/adw";
import type * as Gtk from "@gtkx/ffi/gtk";
import { AdwSpringAnimation, AdwTimedAnimation, GtkBox, GtkButton, GtkLabel } from "@gtkx/react";
import { render, screen, userEvent, waitFor } from "@gtkx/testing";
import React, { createRef, type ReactElement } from "react";
import { describe, expect, it, type Mock, vi } from "vitest";

const expectCompletes = async (animation: ReactElement, label: string, onComplete: Mock, timeout = 500) => {
    await render(animation);
    await screen.findByText(label);
    await waitFor(() => expect(onComplete).toHaveBeenCalled(), { timeout });
};

describe("AdwTimedAnimation / AdwSpringAnimation (1)", () => {
    describe("mount animation (1)", () => {
        it("applies initial values when animateOnMount is false", async () => {
            const buttonRef = createRef<Gtk.Button>();

            await render(
                <AdwTimedAnimation initial={{ opacity: 0.5 }} animate={{ opacity: 1 }} animateOnMount={false}>
                    <GtkButton ref={buttonRef} label="Test" />
                </AdwTimedAnimation>,
            );

            await screen.findByText("Test");
            expect(buttonRef.current).toBeDefined();
        });

        it("applies animate values directly when initial is false", async () => {
            const buttonRef = createRef<Gtk.Button>();

            await render(
                <AdwTimedAnimation initial={false} animate={{ opacity: 1, scale: 1 }}>
                    <GtkButton ref={buttonRef} label="Test" />
                </AdwTimedAnimation>,
            );

            await screen.findByText("Test");
            expect(buttonRef.current).toBeDefined();
        });
    });
});

describe("AdwTimedAnimation / AdwSpringAnimation (2)", () => {
    describe("mount animation (2)", () => {
        it("animates from initial to animate when animateOnMount is true", async () => {
            const onStart = vi.fn();
            const onComplete = vi.fn();
            const buttonRef = createRef<Gtk.Button>();

            await render(
                <AdwTimedAnimation
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    duration={100}
                    animateOnMount
                    onAnimationStart={onStart}
                    onAnimationComplete={onComplete}
                >
                    <GtkButton ref={buttonRef} label="Test" />
                </AdwTimedAnimation>,
            );

            await screen.findByText("Test");

            await waitFor(() => expect(onStart).toHaveBeenCalled(), { timeout: 500 });

            await waitFor(() => expect(onComplete).toHaveBeenCalled(), { timeout: 500 });
        });
    });
});

describe("AdwTimedAnimation / AdwSpringAnimation (3)", () => {
    describe("animate prop changes", () => {
        it("animates when animate prop changes", async () => {
            const onComplete = vi.fn();

            function TestComponent({ targetOpacity }: { targetOpacity: number }) {
                return (
                    <AdwTimedAnimation
                        animate={{ opacity: targetOpacity }}
                        duration={100}
                        onAnimationComplete={onComplete}
                    >
                        <GtkLabel label="Test" />
                    </AdwTimedAnimation>
                );
            }

            const { rerender } = await render(<TestComponent targetOpacity={1} />);

            await screen.findByText("Test");

            await rerender(<TestComponent targetOpacity={0.5} />);

            await waitFor(() => expect(onComplete).toHaveBeenCalled(), { timeout: 500 });
        });
    });
});

describe("AdwTimedAnimation / AdwSpringAnimation (4)", () => {
    describe("exit animation", () => {
        it("plays exit animation before unmount", async () => {
            const onComplete = vi.fn();

            function TestComponent({ show }: { show: boolean }) {
                return (
                    <GtkBox>
                        {show && (
                            <AdwTimedAnimation
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                duration={100}
                                onAnimationComplete={onComplete}
                            >
                                <GtkLabel label="Fading" />
                            </AdwTimedAnimation>
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
});

describe("AdwTimedAnimation / AdwSpringAnimation (5)", () => {
    describe("spring animation", () => {
        it("creates spring animation with default parameters", async () => {
            const onComplete = vi.fn();
            const buttonRef = createRef<Gtk.Button>();

            await expectCompletes(
                <AdwSpringAnimation
                    initial={{ scale: 0.5 }}
                    animate={{ scale: 1 }}
                    animateOnMount
                    onAnimationComplete={onComplete}
                >
                    <GtkButton ref={buttonRef} label="Spring" />
                </AdwSpringAnimation>,
                "Spring",
                onComplete,
                2000,
            );
        });

        it("respects spring transition parameters", async () => {
            const onComplete = vi.fn();

            await expectCompletes(
                <AdwSpringAnimation
                    initial={{ translateX: -100 }}
                    animate={{ translateX: 0 }}
                    damping={1}
                    stiffness={200}
                    mass={1}
                    animateOnMount
                    onAnimationComplete={onComplete}
                >
                    <GtkLabel label="Bouncy" />
                </AdwSpringAnimation>,
                "Bouncy",
                onComplete,
                2000,
            );
        });
    });
});

describe("AdwTimedAnimation / AdwSpringAnimation (6)", () => {
    describe("timed animation", () => {
        it("respects easing function", async () => {
            const onComplete = vi.fn();

            await expectCompletes(
                <AdwTimedAnimation
                    initial={{ rotate: 0 }}
                    animate={{ rotate: 360 }}
                    duration={100}
                    easing={Adw.Easing.EASE_IN_OUT_CUBIC}
                    animateOnMount
                    onAnimationComplete={onComplete}
                >
                    <GtkLabel label="Rotating" />
                </AdwTimedAnimation>,
                "Rotating",
                onComplete,
            );
        });
    });

    describe("multiple properties", () => {
        it("animates multiple properties simultaneously", async () => {
            const onComplete = vi.fn();

            await expectCompletes(
                <AdwTimedAnimation
                    initial={{ opacity: 0, scale: 0.5, translateY: 50 }}
                    animate={{ opacity: 1, scale: 1, translateY: 0 }}
                    duration={100}
                    animateOnMount
                    onAnimationComplete={onComplete}
                >
                    <GtkLabel label="Multi" />
                </AdwTimedAnimation>,
                "Multi",
                onComplete,
            );
        });
    });
});

describe("AdwTimedAnimation / AdwSpringAnimation (7)", () => {
    describe("skew transforms", () => {
        it("animates skewX and skewY properties", async () => {
            const onComplete = vi.fn();

            await expectCompletes(
                <AdwTimedAnimation
                    initial={{ skewX: 0, skewY: 0 }}
                    animate={{ skewX: 10, skewY: 5 }}
                    duration={100}
                    animateOnMount
                    onAnimationComplete={onComplete}
                >
                    <GtkLabel label="Skewed" />
                </AdwTimedAnimation>,
                "Skewed",
                onComplete,
            );
        });
    });
});

describe("AdwTimedAnimation / AdwSpringAnimation (8)", () => {
    describe("repeating animation", () => {
        it("runs animation with repeat count", async () => {
            const onComplete = vi.fn();

            await expectCompletes(
                <AdwTimedAnimation
                    initial={{ scale: 0.8 }}
                    animate={{ scale: 1.2 }}
                    duration={50}
                    repeat={2}
                    animateOnMount
                    onAnimationComplete={onComplete}
                >
                    <GtkLabel label="Repeating" />
                </AdwTimedAnimation>,
                "Repeating",
                onComplete,
            );
        });

        it("runs animation with alternate", async () => {
            const onComplete = vi.fn();

            await expectCompletes(
                <AdwTimedAnimation
                    initial={{ translateY: 0 }}
                    animate={{ translateY: -20 }}
                    duration={50}
                    repeat={2}
                    alternate
                    animateOnMount
                    onAnimationComplete={onComplete}
                >
                    <GtkLabel label="Alternating" />
                </AdwTimedAnimation>,
                "Alternating",
                onComplete,
            );
        });
    });
});

describe("AdwTimedAnimation / AdwSpringAnimation (9)", () => {
    describe("transform animations (1)", () => {
        it("animates translateX property", async () => {
            const onComplete = vi.fn();

            await expectCompletes(
                <AdwTimedAnimation
                    initial={{ translateX: 0 }}
                    animate={{ translateX: 100 }}
                    duration={100}
                    animateOnMount
                    onAnimationComplete={onComplete}
                >
                    <GtkLabel label="TranslateX" />
                </AdwTimedAnimation>,
                "TranslateX",
                onComplete,
            );
        });

        it("animates translateY property", async () => {
            const onComplete = vi.fn();

            await expectCompletes(
                <AdwTimedAnimation
                    initial={{ translateY: 0 }}
                    animate={{ translateY: 50 }}
                    duration={100}
                    animateOnMount
                    onAnimationComplete={onComplete}
                >
                    <GtkLabel label="TranslateY" />
                </AdwTimedAnimation>,
                "TranslateY",
                onComplete,
            );
        });
    });
});

describe("AdwTimedAnimation / AdwSpringAnimation (10)", () => {
    describe("transform animations (2)", () => {
        it("animates scale property", async () => {
            const onComplete = vi.fn();

            await expectCompletes(
                <AdwTimedAnimation
                    initial={{ scale: 1 }}
                    animate={{ scale: 1.5 }}
                    duration={100}
                    animateOnMount
                    onAnimationComplete={onComplete}
                >
                    <GtkLabel label="Scale" />
                </AdwTimedAnimation>,
                "Scale",
                onComplete,
            );
        });

        it("animates rotate property", async () => {
            const onComplete = vi.fn();

            await expectCompletes(
                <AdwTimedAnimation
                    initial={{ rotate: 0 }}
                    animate={{ rotate: 180 }}
                    duration={100}
                    animateOnMount
                    onAnimationComplete={onComplete}
                >
                    <GtkLabel label="Rotate" />
                </AdwTimedAnimation>,
                "Rotate",
                onComplete,
            );
        });
    });
});

describe("AdwTimedAnimation / AdwSpringAnimation (11)", () => {
    describe("state-driven spring animation (1)", () => {
        it("animates when state triggers animate prop change", async () => {
            const onComplete = vi.fn();

            function BounceDemo() {
                const [trigger, setTrigger] = React.useState(0);

                return (
                    <GtkBox>
                        <GtkButton label="Bounce" onClicked={() => setTrigger((t) => t + 1)} />
                        <AdwSpringAnimation
                            initial={false}
                            animate={{ translateX: trigger % 2 === 0 ? 0 : 150 }}
                            damping={1}
                            stiffness={200}
                            mass={1}
                            onAnimationComplete={onComplete}
                        >
                            <GtkLabel label="Target" />
                        </AdwSpringAnimation>
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

describe("AdwTimedAnimation / AdwSpringAnimation (12)", () => {
    describe("state-driven spring animation (2)", () => {
        it("animates spring with low damping for bouncy effect", async () => {
            const onComplete = vi.fn();

            await expectCompletes(
                <AdwSpringAnimation
                    initial={{ translateX: 0 }}
                    animate={{ translateX: 100 }}
                    damping={0.5}
                    stiffness={100}
                    mass={1}
                    animateOnMount
                    onAnimationComplete={onComplete}
                >
                    <GtkLabel label="Bouncy" />
                </AdwSpringAnimation>,
                "Bouncy",
                onComplete,
                3000,
            );
        });
    });

    describe("animation delay", () => {
        it("delays timed animation start", async () => {
            const onComplete = vi.fn();

            await expectCompletes(
                <AdwTimedAnimation
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    duration={50}
                    delay={50}
                    animateOnMount
                    onAnimationComplete={onComplete}
                >
                    <GtkLabel label="Delayed" />
                </AdwTimedAnimation>,
                "Delayed",
                onComplete,
            );
        });
    });
});

describe("AdwTimedAnimation / AdwSpringAnimation (13)", () => {
    describe("easing functions (1)", () => {
        it("animates with EASE_OUT_BOUNCE easing", async () => {
            const onComplete = vi.fn();

            await expectCompletes(
                <AdwTimedAnimation
                    initial={{ translateX: 0 }}
                    animate={{ translateX: 60 }}
                    duration={100}
                    easing={Adw.Easing.EASE_OUT_BOUNCE}
                    animateOnMount
                    onAnimationComplete={onComplete}
                >
                    <GtkLabel label="Bounce Easing" />
                </AdwTimedAnimation>,
                "Bounce Easing",
                onComplete,
            );
        });

        it("animates with EASE_OUT_ELASTIC easing", async () => {
            const onComplete = vi.fn();

            await expectCompletes(
                <AdwTimedAnimation
                    initial={{ translateX: 0 }}
                    animate={{ translateX: 60 }}
                    duration={100}
                    easing={Adw.Easing.EASE_OUT_ELASTIC}
                    animateOnMount
                    onAnimationComplete={onComplete}
                >
                    <GtkLabel label="Elastic Easing" />
                </AdwTimedAnimation>,
                "Elastic Easing",
                onComplete,
            );
        });
    });
});

describe("AdwTimedAnimation / AdwSpringAnimation (14)", () => {
    describe("easing functions (2)", () => {
        it("animates with LINEAR easing", async () => {
            const onComplete = vi.fn();

            await expectCompletes(
                <AdwTimedAnimation
                    initial={{ translateX: 0 }}
                    animate={{ translateX: 60 }}
                    duration={100}
                    easing={Adw.Easing.LINEAR}
                    animateOnMount
                    onAnimationComplete={onComplete}
                >
                    <GtkLabel label="Linear Easing" />
                </AdwTimedAnimation>,
                "Linear Easing",
                onComplete,
            );
        });
    });
});
