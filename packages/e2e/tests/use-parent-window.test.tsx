import type * as Gtk from "@gtkx/gi/gtk";
import * as Gio from "@gtkx/gi/gio";
import { GSimpleAction } from "@gtkx/jsx/gio";
import { GtkApplication, GtkApplicationWindow, type GtkApplicationWindowProps, GtkBox } from "@gtkx/jsx/gtk";
import { rootElement, useParentWindow } from "@gtkx/react";
import { render } from "@gtkx/testing";
import { describe, expect, it } from "vitest";

let nextAppId = 0;
const uniqueAppId = (): string => `org.gtkx.useparentwindowtest${nextAppId++}`;

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
        let captured: unknown = "unset";

        const Probe = () => {
            captured = useParentWindow();
            return null;
        };

        const windowInstance = await renderProbedWindow({ children: <Probe /> });

        expect(windowInstance).not.toBeNull();
        expect(captured).toBe(windowInstance);
    });

    it("reaches the titlebar, controllers, and actions slots, not just children", async () => {
        let titlebarWindow: unknown = "unset";
        let controllerWindow: unknown = "unset";
        let actionWindow: unknown = "unset";

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

        const windowInstance = await renderProbedWindow({
            titlebar: (
                <GtkBox>
                    <TitlebarProbe />
                </GtkBox>
            ),
            controllers: <ControllerProbe />,
            actions: (
                <>
                    <GSimpleAction name="noop" />
                    <ActionProbe />
                </>
            ),
        });

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
