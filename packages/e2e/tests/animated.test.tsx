import { animated } from "@gtkx/animate";
import { GtkButton } from "@gtkx/jsx/gtk";
import { render, screen, waitFor } from "@gtkx/testing";
import { describe, expect, it, vi } from "vitest";

describe("animated", () => {
    it("animates a built-in widget accessed by name", async () => {
        const onComplete = vi.fn();

        await render(
            <animated.GtkLabel
                label="Fade"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.1 }}
                onAnimationComplete={onComplete}
            />,
        );

        await screen.findByText("Fade");
        await waitFor(() => expect(onComplete).toHaveBeenCalled(), { timeout: 500 });
    });

    it("wraps a custom component via create()", async () => {
        const Button = animated.create(GtkButton);
        const onComplete = vi.fn();

        await render(
            <Button
                label="Press"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.1 }}
                onAnimationComplete={onComplete}
            />,
        );

        await screen.findByText("Press");
        await waitFor(() => expect(onComplete).toHaveBeenCalled(), { timeout: 500 });
    });

    it("exposes a stable, memoized component per widget name", () => {
        expect(animated.GtkLabel).toBe(animated.GtkLabel);
        expect(animated.GtkLabel).not.toBe(animated.GtkButton);
    });
});
