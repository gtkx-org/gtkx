import { whenStopped } from "@gtkx/ffi";
import * as Gio from "@gtkx/gi/gio";
import type * as Gtk from "@gtkx/gi/gtk";
import { quit, render, useApplication } from "@gtkx/react";
import { GtkApplication, GtkApplicationWindow } from "@gtkx/react-gi/gtk";
import { Component, createRef, type ReactNode } from "react";
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
        const appRef = createRef<Gtk.Application>();
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

        render(
            <GtkApplication
                ref={appRef}
                applicationId="org.gtkx.render-coverage"
                flags={Gio.ApplicationFlags.NON_UNIQUE}
            >
                <Probe />
            </GtkApplication>,
        );
        await new Promise((resolve) => setTimeout(resolve, 0));

        const messages = errorSpy.mock.calls.map((call) => String(call[0])).join("\n");
        expect(messages).toContain("boom-from-render");
        errorSpy.mockRestore();

        const app = appRef.current;
        expect(app).not.toBeNull();
        expect(app?.getIsRegistered()).toBe(true);
        expect(resolvedApp).toBe(app);

        quit();
        await new Promise((resolve) => setTimeout(resolve, 100));

        expect(stopHandler).toHaveBeenCalledTimes(1);
    });
});
