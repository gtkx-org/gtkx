import type * as Gtk from "@gtkx/gi/gtk";
import * as Gio from "@gtkx/gi/gio";
import { GSimpleAction } from "@gtkx/jsx/gio";
import { GtkApplication, GtkApplicationWindow, type GtkApplicationWindowProps, GtkBox } from "@gtkx/jsx/gtk";
import { rootElement, useParentWindow } from "@gtkx/react";
import { render } from "@gtkx/testing";
import { useEffect } from "react";
import { describe, expect, it } from "vitest";
import { createAppIdFactory } from "./helpers/unique-name.js";

type ProbeProps = { slot: string };

const captured: Record<string, Gtk.Window | null> = {};
const uniqueAppId = createAppIdFactory("org.gtkx.useparentwindowtest");

const Probe = ({ slot }: ProbeProps) => {
    const parentWindow = useParentWindow();

    useEffect(() => {
        captured[slot] = parentWindow;
    }, [slot, parentWindow]);

    return null;
};

const renderProbedWindow = async (props: GtkApplicationWindowProps): Promise<Gtk.Window | null> => {
    let windowInstance: Gtk.Window | null = null;

    await render(
        <GtkApplication applicationId={uniqueAppId()} flags={Gio.ApplicationFlags.NON_UNIQUE}>
            <GtkApplicationWindow
                ref={(instance) => {
                    windowInstance = instance;
                }}
                defaultWidth={100}
                defaultHeight={100}
                {...props}
            />
        </GtkApplication>,
        { container: rootElement },
    );

    return windowInstance;
};

describe("useParentWindow", () => {
    it("returns the window provided by createWindowComponent", async () => {
        const windowInstance = await renderProbedWindow({ children: <Probe slot="children" /> });
        expect(windowInstance).not.toBeNull();
        expect(captured.children).toBe(windowInstance);
    });

    it("reaches the titlebar, controllers, and actions slots, not just children", async () => {
        const windowInstance = await renderProbedWindow({
            titlebar: (
                <GtkBox>
                    <Probe slot="titlebar" />
                </GtkBox>
            ),
            controllers: <Probe slot="controllers" />,
            actions: (
                <>
                    <GSimpleAction name="noop" />
                    <Probe slot="actions" />
                </>
            ),
        });

        expect(windowInstance).not.toBeNull();
        expect(captured.titlebar).toBe(windowInstance);
        expect(captured.controllers).toBe(windowInstance);
        expect(captured.actions).toBe(windowInstance);
    });

    it("throws when there is no createWindowComponent ancestor", async () => {
        await expect(render(<Probe slot="orphan" />)).rejects.toThrow(
            "useParentWindow must be called within a window element",
        );
    });

    it("never exposes a window that has not been constructed", async () => {
        const seen: (Gtk.Window | null)[] = [];

        const RenderProbe = () => {
            seen.push(useParentWindow());

            return null;
        };

        await render(
            <GtkApplication applicationId={uniqueAppId()} flags={Gio.ApplicationFlags.NON_UNIQUE}>
                <GtkApplicationWindow defaultWidth={100} defaultHeight={100}>
                    <RenderProbe />
                </GtkApplicationWindow>
            </GtkApplication>,
            { container: rootElement },
        );

        expect(seen.length).toBeGreaterThan(0);
        expect(seen.every((window) => window !== null)).toBe(true);
    });
});
