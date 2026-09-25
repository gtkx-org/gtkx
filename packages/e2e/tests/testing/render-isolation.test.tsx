import type { ReactNode } from "react";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkButton, GtkLabel } from "@gtkx/jsx/gtk";
import { createRoot, rootElement } from "@gtkx/react";
import { act, cleanup, render, userEvent } from "@gtkx/testing";
import { Component, useState } from "react";
import { describe, expect, it } from "vitest";

type ErrorMode = "caught" | "uncaught";

const ERROR_MODES: ErrorMode[] = ["caught", "uncaught"];

const Thrower = (): ReactNode => {
    throw new Error("Render failed");
};

class ErrorBoundary extends Component<{ children: ReactNode }, { hasFailed: boolean }> {
    static getDerivedStateFromError(): { hasFailed: boolean } {
        return { hasFailed: true };
    }

    override state = { hasFailed: false };

    override render(): ReactNode {
        return this.state.hasFailed ? <GtkLabel>Fallback</GtkLabel> : this.props.children;
    }
}

const withBoundary = (children: ReactNode, mode: ErrorMode): ReactNode =>
    mode === "caught" ? <ErrorBoundary>{children}</ErrorBoundary> : children;

const BreakableButton = (): ReactNode => {
    const [hasFailed, setFailed] = useState(false);

    return hasFailed
        ? <Thrower />
        : (
                <GtkButton
                    label="Fail this render"
                    onClicked={() => {
                        setFailed(true);
                    }}
                />
            );
};

describe("render root isolation", () => {
    it.each(ERROR_MODES)("keeps another root's handled %s error out of render and rerender", async (mode) => {
        const existing = await render(<GtkLabel>Existing</GtkLabel>);
        const handled = Promise.withResolvers<undefined>();
        const handleError = (): void => {
            handled.resolve(undefined);
        };
        const root = createRoot({ ...rootElement }, {
            onCaughtError: handleError,
            onUncaughtError: handleError,
        });

        try {
            root.render(withBoundary(<Thrower />, mode));
            await handled.promise;

            await existing.rerender(<GtkLabel>Updated</GtkLabel>);
            expect(existing.getByText("Updated")).toBeRooted();
            const fresh = await render(<GtkLabel>Fresh</GtkLabel>);
            expect(fresh.getByText("Fresh")).toBeRooted();
        } finally {
            await act(() => {
                root.unmount();
            });
        }
    });

    it("keeps a pending caught error with its own testing root", async () => {
        const failing = await render(<ErrorBoundary><BreakableButton /></ErrorBoundary>);
        const healthy = await render(<GtkLabel>Healthy</GtkLabel>);

        await userEvent.click(failing.getByRole(Gtk.AccessibleRole.BUTTON, { name: "Fail this render" }));
        await healthy.rerender(<GtkLabel>Unaffected</GtkLabel>);
        expect(healthy.getByText("Unaffected")).toBeRooted();

        await expect(failing.rerender(<GtkLabel>Recovered</GtkLabel>)).rejects.toThrow();
        await failing.rerender(<GtkLabel>Recovered</GtkLabel>);
        expect(failing.getByText("Recovered")).toBeRooted();

        await failing.unmount();
        await healthy.rerender(<GtkLabel>Still mounted</GtkLabel>);
        expect(healthy.getByText("Still mounted")).toBeRooted();
    });

    it.each(ERROR_MODES)("rejects its own initial %s error and permits cleanup and a fresh render", async (mode) => {
        await expect(render(withBoundary(<Thrower />, mode))).rejects.toThrow();
        await cleanup();

        const recovered = await render(<GtkLabel>Recovered</GtkLabel>);
        expect(recovered.getByText("Recovered")).toBeRooted();
    });

    it.each(ERROR_MODES)("rejects its own %s rerender error and permits recovery", async (mode) => {
        const failing = await render(<GtkLabel>Initial</GtkLabel>);
        const healthy = await render(<GtkLabel>Healthy</GtkLabel>);

        await expect(failing.rerender(withBoundary(<Thrower />, mode))).rejects.toThrow();
        await healthy.rerender(<GtkLabel>Unaffected</GtkLabel>);
        expect(healthy.getByText("Unaffected")).toBeRooted();
        await failing.rerender(<GtkLabel>Recovered</GtkLabel>);
        expect(failing.getByText("Recovered")).toBeRooted();
    });
});
