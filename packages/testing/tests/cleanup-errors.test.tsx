import type { ReactNode } from "react";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkLabel } from "@gtkx/jsx/gtk";
import { cleanup, render, screen } from "@gtkx/testing";
import { useEffect } from "react";
import { describe, expect, it } from "vitest";
import { withHostWindow } from "./widget-fixtures.js";

type CleanupProbeProps = {
    label: string;
    onCleanup: () => void;
};

const CleanupProbe = ({ label, onCleanup }: CleanupProbeProps): ReactNode => {
    useEffect(() => onCleanup, [onCleanup]);

    return <GtkLabel>{label}</GtkLabel>;
};

describe("render cleanup errors", () => {
    it("destroys its harness when effect cleanup throws and keeps unmount idempotent", async () => {
        let cleanupCalls = 0;
        const rendered = await render(
            <CleanupProbe
                label="Owned"
                onCleanup={() => {
                    cleanupCalls += 1;
                    throw new Error("Cleanup failed");
                }}
            />,
        );

        expect(await rendered.findByText("Owned")).toBeRooted();
        await expect(rendered.unmount()).rejects.toThrow();
        expect(cleanupCalls).toBe(1);
        expect(Gtk.Window.listToplevels()).not.toContain(rendered.container);
        await rendered.unmount();
        await cleanup();
        expect(cleanupCalls).toBe(1);
    });

    it("cleans later roots after an effect throws and supports a fresh render", async () => {
        const cleaned: string[] = [];
        const first = await render(
            <CleanupProbe
                label="First"
                onCleanup={() => {
                    cleaned.push("first");
                    throw new Error("Cleanup failed");
                }}
            />,
        );
        const second = await render(
            <CleanupProbe
                label="Second"
                onCleanup={() => {
                    expect(screen.queryByText("First")).toBeNull();
                    cleaned.push("second");
                }}
            />,
        );

        expect(await second.findByText("Second")).toBeRooted();
        await expect(cleanup()).rejects.toThrow();
        expect(cleaned).toEqual(["first", "second"]);
        const remaining = Gtk.Window.listToplevels();
        expect(remaining).not.toContain(first.container);
        expect(remaining).not.toContain(second.container);
        await cleanup();
        expect(cleaned).toEqual(["first", "second"]);
        const recovered = await render(<GtkLabel>Recovered</GtkLabel>);
        expect(await recovered.findByText("Recovered")).toBeRooted();
    });

    it("preserves a supplied container and its window after effect cleanup throws", async () => {
        await withHostWindow(async (host, content) => {
            host.present();
            let cleanupCalls = 0;
            const rendered = await render(
                <CleanupProbe
                    label="Supplied"
                    onCleanup={() => {
                        cleanupCalls += 1;
                        throw new Error("Cleanup failed");
                    }}
                />,
                { container: content },
            );

            expect(await rendered.findByText("Supplied")).toBeRooted();
            await expect(rendered.unmount()).rejects.toThrow();
            expect(cleanupCalls).toBe(1);
            expect(Gtk.Window.listToplevels()).toContain(host);
            expect(content.getFirstChild()).toBeNull();
            const recovered = await render(<GtkLabel>Reused</GtkLabel>, { container: content });
            expect(await recovered.findByText("Reused")).toBeRooted();
            await recovered.unmount();
            expect(content.getFirstChild()).toBeNull();
            expect(Gtk.Window.listToplevels()).toContain(host);
        });
    });
});
