import type * as Gtk from "@gtkx/gi/gtk";
import * as Gio from "@gtkx/gi/gio";
import { GtkApplication, GtkApplicationWindow } from "@gtkx/jsx/gtk";
import { rootElement } from "@gtkx/react";
import { render } from "@gtkx/testing";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";

describe("Root.unmount", () => {
    it("shuts the application down when the unmounted tree contains the application component", async () => {
        const appRef = createRef<Gtk.Application>();

        const { unmount } = await render(
            <GtkApplication
                ref={appRef}
                applicationId="org.gtkx.render-unmount"
                flags={Gio.ApplicationFlags.NON_UNIQUE}
            >
                <GtkApplicationWindow defaultWidth={50} defaultHeight={50} />
            </GtkApplication>,
            { container: rootElement },
        );

        const app = appRef.current;

        if (!app) {
            throw new Error("application was not captured");
        }

        const shutdownHandler = vi.fn();
        app.on("shutdown", shutdownHandler);
        expect(app.getIsRegistered()).toBe(true);
        await unmount();
        expect(shutdownHandler).toHaveBeenCalledTimes(1);
        expect(app.getIsRegistered()).toBe(false);
    });
});
