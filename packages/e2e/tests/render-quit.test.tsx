import { whenStopped } from "@gtkx/ffi";
import * as Gio from "@gtkx/ffi/gio";
import * as Gtk from "@gtkx/ffi/gtk";
import { GtkApplicationWindow, quit, render, useApplication } from "@gtkx/react";
import { Component, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

declare global {
    var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

let previousActEnvironment: boolean | undefined;

beforeEach(() => {
    previousActEnvironment = globalThis.IS_REACT_ACT_ENVIRONMENT;
    globalThis.IS_REACT_ACT_ENVIRONMENT = false;
});

afterEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment;
});

describe("render and quit", () => {
    it("logs caught render errors via console.error and registers the app", async () => {
        const app = new Gtk.Application({
            application_id: "org.gtkx.render-coverage",
            flags: Gio.ApplicationFlags.NON_UNIQUE,
        });
        const stopHandler = vi.fn();
        whenStopped().then(stopHandler);
        const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

        const Boom = (): null => {
            throw new Error("boom-from-render");
        };

        class ErrorBoundary extends Component<{ children: ReactNode }, { errored: boolean }> {
            override state = { errored: false };
            static getDerivedStateFromError(): { errored: boolean } {
                return { errored: true };
            }
            override render(): ReactNode {
                return this.state.errored ? (
                    <GtkApplicationWindow defaultWidth={50} defaultHeight={50} />
                ) : (
                    this.props.children
                );
            }
        }

        let resolvedApp: Gtk.Application | null = null;
        const Probe = (): ReactNode => {
            resolvedApp = useApplication();
            return (
                <ErrorBoundary>
                    <Boom />
                </ErrorBoundary>
            );
        };

        render(<Probe />, app);
        await new Promise((resolve) => setTimeout(resolve, 0));

        const messages = errorSpy.mock.calls.map((call) => String(call[0])).join("\n");
        expect(messages).toContain("boom-from-render");
        errorSpy.mockRestore();

        expect(app.getIsRegistered()).toBe(true);
        expect(resolvedApp).toBe(app);

        quit();
        await new Promise((resolve) => setTimeout(resolve, 100));

        expect(stopHandler).toHaveBeenCalledTimes(1);
    });
});
