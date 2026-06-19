import * as Gio from "@gtkx/gi/gio";
import type * as Gtk from "@gtkx/gi/gtk";
import { GtkApplication, GtkApplicationWindow } from "@gtkx/jsx/gtk";
import { createRoot, quit, useApplication } from "@gtkx/react";
import { Component, createRef, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { setupRealRenderEnvironment } from "./helpers/real-render-environment.js";

setupRealRenderEnvironment();

describe("render and quit", () => {
    it("logs caught render errors via console.error and registers the app", async () => {
        const appRef = createRef<Gtk.Application>();
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

        createRoot().render(
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

        const shutdownHandler = vi.fn();
        app?.on("shutdown", shutdownHandler);

        quit();
        await new Promise((resolve) => setTimeout(resolve, 100));

        expect(shutdownHandler).toHaveBeenCalledTimes(1);
    });
});
