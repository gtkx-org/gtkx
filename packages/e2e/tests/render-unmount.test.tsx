import * as Gio from "@gtkx/gi/gio";
import type * as Gtk from "@gtkx/gi/gtk";
import { GtkApplication, GtkApplicationWindow } from "@gtkx/jsx/gtk";
import { createRoot } from "@gtkx/react";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { setupRealRenderEnvironment } from "./helpers/real-render-environment.js";

setupRealRenderEnvironment();

describe("Root.unmount", () => {
    it("shuts the application down when the unmounted tree contains the application component", async () => {
        const appRef = createRef<Gtk.Application>();
        const root = createRoot();
        root.render(
            <GtkApplication
                ref={appRef}
                applicationId="org.gtkx.render-unmount"
                flags={Gio.ApplicationFlags.NON_UNIQUE}
            >
                <GtkApplicationWindow defaultWidth={50} defaultHeight={50} />
            </GtkApplication>,
        );
        await new Promise((resolve) => setTimeout(resolve, 0));

        const app = appRef.current;
        if (!app) throw new Error("application was not captured");
        const shutdownHandler = vi.fn();
        app.on("shutdown", shutdownHandler);

        root.unmount();
        await new Promise((resolve) => setTimeout(resolve, 100));

        expect(shutdownHandler).toHaveBeenCalledTimes(1);
    });
});
