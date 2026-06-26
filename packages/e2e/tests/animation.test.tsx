import { AnimatePresence, WidgetAnimation } from "@gtkx/animate";
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
        <WidgetAnimation
            initial={{ x: from }}
            animate={{ x: to }}
            transition={{ type: "spring", damping, stiffness, mass: 1 }}
            onAnimationComplete={onComplete}
        >
            <GtkLabel label="Bouncy" />
        </WidgetAnimation>,
        "Bouncy",
        onComplete,
        timeout,
    );
};

describe("WidgetAnimation (1)", () => {
    describe("mount animation (1)", () => {
        it("applies initial values when no animate target is set", async () => {
            const buttonRef = createRef<Gtk.Button>();

            await render(
                <WidgetAnimation initial={{ opacity: 0.5 }}>
                    <GtkButton ref={buttonRef} label="Test" />
                </WidgetAnimation>,
            );

            await screen.findByText("Test");
            expect(buttonRef.current).toBeDefined();
        });

        it("applies animate values directly when initial is false", async () => {
            const buttonRef = createRef<Gtk.Button>();

            await render(
                <WidgetAnimation initial={false} animate={{ opacity: 1, scale: 1 }}>
                    <GtkButton ref={buttonRef} label="Test" />
                </WidgetAnimation>,
            );

            await screen.findByText("Test");
            expect(buttonRef.current).toBeDefined();
        });
    });
});

describe("WidgetAnimation (2)", () => {
    describe("mount animation (2)", () => {
        it("animates from initial to animate on mount", async () => {
            const onStart = vi.fn();
            const onComplete = vi.fn();
            const buttonRef = createRef<Gtk.Button>();

            await render(
                <WidgetAnimation
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.1 }}
                    onAnimationStart={onStart}
                    onAnimationComplete={onComplete}
                >
                    <GtkButton ref={buttonRef} label="Test" />
                </WidgetAnimation>,
            );

            await screen.findByText("Test");

            await waitFor(() => expect(onStart).toHaveBeenCalled());

            await waitFor(() => expect(onComplete).toHaveBeenCalled());
        });
    });
});

describe("WidgetAnimation (3)", () => {
    describe("animate prop changes", () => {
        it("animates when animate prop changes", async () => {
            const onComplete = vi.fn();

            function TestComponent({ targetOpacity }: { targetOpacity: number }) {
                return (
                    <WidgetAnimation
                        animate={{ opacity: targetOpacity }}
                        transition={{ duration: 0.1 }}
                        onAnimationComplete={onComplete}
                    >
                        <GtkLabel label="Test" />
                    </WidgetAnimation>
                );
            }

            const { rerender } = await render(<TestComponent targetOpacity={1} />);

            await screen.findByText("Test");

            await rerender(<TestComponent targetOpacity={0.5} />);

            await waitFor(() => expect(onComplete).toHaveBeenCalled());
        });
    });
});

describe("WidgetAnimation (4)", () => {
    describe("exit animation", () => {
        it("plays exit animation before unmount", async () => {
            const onComplete = vi.fn();

            function TestComponent({ show }: { show: boolean }) {
                return (
                    <GtkBox>
                        <AnimatePresence>
                            {show && (
                                <WidgetAnimation
                                    key="fading"
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    transition={{ duration: 0.1 }}
                                    onAnimationComplete={onComplete}
                                >
                                    <GtkLabel label="Fading" />
                                </WidgetAnimation>
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

describe("WidgetAnimation (5)", () => {
    describe("spring animation", () => {
        it("creates spring animation with default parameters", async () => {
            const onComplete = vi.fn();
            const buttonRef = createRef<Gtk.Button>();

            await expectCompletes(
                <WidgetAnimation
                    initial={{ scale: 0.5 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring" }}
                    onAnimationComplete={onComplete}
                >
                    <GtkButton ref={buttonRef} label="Spring" />
                </WidgetAnimation>,
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

describe("WidgetAnimation (6)", () => {
    describe("timed animation", () => {
        it("respects easing function", async () => {
            const onComplete = vi.fn();

            await expectCompletes(
                <WidgetAnimation
                    initial={{ rotate: 0 }}
                    animate={{ rotate: 360 }}
                    transition={{ duration: 0.1, ease: "easeInOut" }}
                    onAnimationComplete={onComplete}
                >
                    <GtkLabel label="Rotating" />
                </WidgetAnimation>,
                "Rotating",
                onComplete,
            );
        });
    });

    describe("multiple properties", () => {
        it("animates multiple properties simultaneously", async () => {
            const onComplete = vi.fn();

            await expectCompletes(
                <WidgetAnimation
                    initial={{ opacity: 0, scale: 0.5, y: 50 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ duration: 0.1 }}
                    onAnimationComplete={onComplete}
                >
                    <GtkLabel label="Multi" />
                </WidgetAnimation>,
                "Multi",
                onComplete,
            );
        });
    });
});

describe("WidgetAnimation (7)", () => {
    describe("skew transforms", () => {
        it("animates skewX and skewY properties", async () => {
            const onComplete = vi.fn();

            await expectCompletes(
                <WidgetAnimation
                    initial={{ skewX: 0, skewY: 0 }}
                    animate={{ skewX: 10, skewY: 5 }}
                    transition={{ duration: 0.1 }}
                    onAnimationComplete={onComplete}
                >
                    <GtkLabel label="Skewed" />
                </WidgetAnimation>,
                "Skewed",
                onComplete,
            );
        });
    });
});

describe("WidgetAnimation (8)", () => {
    describe("repeating animation", () => {
        it("runs animation with repeat count", async () => {
            const onComplete = vi.fn();

            await expectCompletes(
                <WidgetAnimation
                    initial={{ scale: 0.8 }}
                    animate={{ scale: 1.2 }}
                    transition={{ duration: 0.05, repeat: 2 }}
                    onAnimationComplete={onComplete}
                >
                    <GtkLabel label="Repeating" />
                </WidgetAnimation>,
                "Repeating",
                onComplete,
            );
        });

        it("runs animation with reverse repeat type", async () => {
            const onComplete = vi.fn();

            await expectCompletes(
                <WidgetAnimation
                    initial={{ y: 0 }}
                    animate={{ y: -20 }}
                    transition={{ duration: 0.05, repeat: 2, repeatType: "reverse" }}
                    onAnimationComplete={onComplete}
                >
                    <GtkLabel label="Alternating" />
                </WidgetAnimation>,
                "Alternating",
                onComplete,
            );
        });
    });
});

describe("WidgetAnimation (9)", () => {
    describe("transform animations (1)", () => {
        it("animates x property", async () => {
            const onComplete = vi.fn();

            await expectCompletes(
                <WidgetAnimation
                    initial={{ x: 0 }}
                    animate={{ x: 100 }}
                    transition={{ duration: 0.1 }}
                    onAnimationComplete={onComplete}
                >
                    <GtkLabel label="TranslateX" />
                </WidgetAnimation>,
                "TranslateX",
                onComplete,
            );
        });

        it("animates y property", async () => {
            const onComplete = vi.fn();

            await expectCompletes(
                <WidgetAnimation
                    initial={{ y: 0 }}
                    animate={{ y: 50 }}
                    transition={{ duration: 0.1 }}
                    onAnimationComplete={onComplete}
                >
                    <GtkLabel label="TranslateY" />
                </WidgetAnimation>,
                "TranslateY",
                onComplete,
            );
        });
    });
});

describe("WidgetAnimation (10)", () => {
    describe("transform animations (2)", () => {
        it("animates scale property", async () => {
            const onComplete = vi.fn();

            await expectCompletes(
                <WidgetAnimation
                    initial={{ scale: 1 }}
                    animate={{ scale: 1.5 }}
                    transition={{ duration: 0.1 }}
                    onAnimationComplete={onComplete}
                >
                    <GtkLabel label="Scale" />
                </WidgetAnimation>,
                "Scale",
                onComplete,
            );
        });

        it("animates rotate property", async () => {
            const onComplete = vi.fn();

            await expectCompletes(
                <WidgetAnimation
                    initial={{ rotate: 0 }}
                    animate={{ rotate: 180 }}
                    transition={{ duration: 0.1 }}
                    onAnimationComplete={onComplete}
                >
                    <GtkLabel label="Rotate" />
                </WidgetAnimation>,
                "Rotate",
                onComplete,
            );
        });
    });
});

describe("WidgetAnimation (11)", () => {
    describe("state-driven spring animation (1)", () => {
        it("animates when state triggers animate prop change", async () => {
            const onComplete = vi.fn();

            function BounceDemo() {
                const [trigger, setTrigger] = React.useState(0);

                return (
                    <GtkBox>
                        <GtkButton label="Bounce" onClicked={() => setTrigger((t) => t + 1)} />
                        <WidgetAnimation
                            initial={false}
                            animate={{ x: trigger % 2 === 0 ? 0 : 150 }}
                            transition={{ type: "spring", damping: 28, stiffness: 200, mass: 1 }}
                            onAnimationComplete={onComplete}
                        >
                            <GtkLabel label="Target" />
                        </WidgetAnimation>
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

describe("WidgetAnimation (12)", () => {
    describe("state-driven spring animation (2)", () => {
        it("animates spring with low damping for bouncy effect", async () => {
            await expectSpringXCompletes({ from: 0, to: 100, damping: 0.5, stiffness: 100, timeout: 3000 });
        });
    });

    describe("animation delay", () => {
        it("delays timed animation start", async () => {
            const onComplete = vi.fn();

            await expectCompletes(
                <WidgetAnimation
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.05, delay: 0.05 }}
                    onAnimationComplete={onComplete}
                >
                    <GtkLabel label="Delayed" />
                </WidgetAnimation>,
                "Delayed",
                onComplete,
            );
        });
    });
});

describe("WidgetAnimation (13)", () => {
    describe("easing functions (1)", () => {
        it("animates with easeOut easing", async () => {
            const onComplete = vi.fn();

            await expectCompletes(
                <WidgetAnimation
                    initial={{ x: 0 }}
                    animate={{ x: 60 }}
                    transition={{ duration: 0.1, ease: "easeOut" }}
                    onAnimationComplete={onComplete}
                >
                    <GtkLabel label="Ease Out" />
                </WidgetAnimation>,
                "Ease Out",
                onComplete,
            );
        });

        it("animates with easeIn easing", async () => {
            const onComplete = vi.fn();

            await expectCompletes(
                <WidgetAnimation
                    initial={{ x: 0 }}
                    animate={{ x: 60 }}
                    transition={{ duration: 0.1, ease: "easeIn" }}
                    onAnimationComplete={onComplete}
                >
                    <GtkLabel label="Ease In" />
                </WidgetAnimation>,
                "Ease In",
                onComplete,
            );
        });
    });
});

describe("WidgetAnimation (14)", () => {
    describe("easing functions (2)", () => {
        it("animates with linear easing", async () => {
            const onComplete = vi.fn();

            await expectCompletes(
                <WidgetAnimation
                    initial={{ x: 0 }}
                    animate={{ x: 60 }}
                    transition={{ duration: 0.1, ease: "linear" }}
                    onAnimationComplete={onComplete}
                >
                    <GtkLabel label="Linear Easing" />
                </WidgetAnimation>,
                "Linear Easing",
                onComplete,
            );
        });
    });
});
