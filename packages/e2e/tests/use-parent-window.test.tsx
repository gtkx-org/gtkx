import * as Gio from "@gtkx/gi/gio";
import type * as Gtk from "@gtkx/gi/gtk";
import { GSimpleAction } from "@gtkx/jsx/gio";
import { GtkApplication, GtkApplicationWindow, GtkBox } from "@gtkx/jsx/gtk";
import { rootElement, useParentWindow } from "@gtkx/react";
import { render } from "@gtkx/testing";
import { describe, expect, it } from "vitest";

let nextAppId = 0;
const uniqueAppId = (): string => `org.gtkx.useparentwindowtest${nextAppId++}`;

describe("useParentWindow", () => {
    it("returns the window provided by createWindowComponent", async () => {
        let captured: unknown = "unset";
        let windowInstance: Gtk.Window | null = null;

        const Probe = () => {
            captured = useParentWindow();
            return null;
        };

        await render(
            <GtkApplication applicationId={uniqueAppId()} flags={Gio.ApplicationFlags.NON_UNIQUE}>
                <GtkApplicationWindow
                    ref={(instance) => {
                        windowInstance = instance;
                    }}
                    defaultWidth={100}
                    defaultHeight={100}
                >
                    <Probe />
                </GtkApplicationWindow>
            </GtkApplication>,
            { container: rootElement },
        );

        expect(windowInstance).not.toBeNull();
        expect(captured).toBe(windowInstance);
    });

    it("reaches the titlebar, controllers, and actions slots, not just children", async () => {
        let titlebarWindow: unknown = "unset";
        let controllerWindow: unknown = "unset";
        let actionWindow: unknown = "unset";
        let windowInstance: Gtk.Window | null = null;

        const TitlebarProbe = () => {
            titlebarWindow = useParentWindow();
            return null;
        };
        const ControllerProbe = () => {
            controllerWindow = useParentWindow();
            return null;
        };
        const ActionProbe = () => {
            actionWindow = useParentWindow();
            return null;
        };

        await render(
            <GtkApplication applicationId={uniqueAppId()} flags={Gio.ApplicationFlags.NON_UNIQUE}>
                <GtkApplicationWindow
                    ref={(instance) => {
                        windowInstance = instance;
                    }}
                    defaultWidth={100}
                    defaultHeight={100}
                    titlebar={
                        <GtkBox>
                            <TitlebarProbe />
                        </GtkBox>
                    }
                    controllers={<ControllerProbe />}
                    actions={
                        <>
                            <GSimpleAction name="noop" />
                            <ActionProbe />
                        </>
                    }
                />
            </GtkApplication>,
            { container: rootElement },
        );

        expect(windowInstance).not.toBeNull();
        expect(titlebarWindow).toBe(windowInstance);
        expect(controllerWindow).toBe(windowInstance);
        expect(actionWindow).toBe(windowInstance);
    });

    it("returns null when there is no createWindowComponent ancestor", async () => {
        let captured: unknown = "unset";

        const Probe = () => {
            captured = useParentWindow();
            return null;
        };

        await render(<Probe />);

        expect(captured).toBeNull();
    });
});
