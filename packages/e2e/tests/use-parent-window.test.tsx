import type * as Gtk from "@gtkx/gi/gtk";
import { GSimpleAction } from "@gtkx/jsx/gio";
import { GtkApplicationWindow, type GtkApplicationWindowProps, GtkBox } from "@gtkx/jsx/gtk";
import { useParentWindow } from "@gtkx/react";
import { render } from "@gtkx/testing";
import { useEffect } from "react";
import { describe, expect, it } from "vitest";
import { createApplicationRenderer } from "./helpers/application-render.js";

type ProbeProps = { slot: string };

const captured: Record<string, Gtk.Window | null> = {};
const renderApplication = createApplicationRenderer("org.gtkx.useparentwindowtest");

const Probe = ({ slot }: ProbeProps) => {
    const parentWindow = useParentWindow();

    useEffect(() => {
        captured[slot] = parentWindow;
    }, [slot, parentWindow]);

    return null;
};

const renderProbedWindow = async (props: GtkApplicationWindowProps): Promise<Gtk.Window | null> => {
    let windowInstance: Gtk.Window | null = null;

    await renderApplication(
        <GtkApplicationWindow
            ref={(instance) => {
                windowInstance = instance;
            }}
            defaultWidth={100}
            defaultHeight={100}
            {...props}
        />,
    );

    return windowInstance;
};

describe("useParentWindow", () => {
    it("returns the window provided by the enclosing window element", async () => {
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

    it("returns null when there is no window ancestor", async () => {
        await render(<Probe slot="orphan" />);
        expect(captured.orphan).toBeNull();
    });

    it("is null on the first render inside a window and resolves on the next", async () => {
        const seen: string[] = [];

        const RenderProbe = () => {
            seen.push(useParentWindow() === null ? "null" : "window");

            return null;
        };

        await renderApplication(
            <GtkApplicationWindow defaultWidth={100} defaultHeight={100}>
                <RenderProbe />
            </GtkApplicationWindow>,
        );

        expect(seen).toEqual(["null", "window"]);
    });
});
