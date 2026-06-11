import * as Gio from "@gtkx/gi/gio";
import type * as Gtk from "@gtkx/gi/gtk";
import { GtkApplication, GtkApplicationWindow, GtkLabel } from "@gtkx/jsx/gtk";
import { render } from "@gtkx/react";
import { screenshot } from "@gtkx/testing";
import { createRef } from "react";
import { describe, expect, it } from "vitest";
import { setupRealRenderEnvironment } from "./helpers/real-render-environment.js";

setupRealRenderEnvironment();

describe("screenshot outside the act environment", () => {
    it("captures a presented window rendered through the production render", async () => {
        const windowRef = createRef<Gtk.ApplicationWindow>();

        render(
            <GtkApplication applicationId="org.gtkx.screenshot-real" flags={Gio.ApplicationFlags.NON_UNIQUE}>
                <GtkApplicationWindow ref={windowRef} defaultWidth={200} defaultHeight={120}>
                    <GtkLabel label="Shot" />
                </GtkApplicationWindow>
            </GtkApplication>,
        );
        await new Promise((resolve) => setTimeout(resolve, 200));

        const window = windowRef.current;
        if (!window) throw new Error("window was not captured");

        const result = await screenshot(window, { timeout: 2000 });
        expect(result.mimeType).toBe("image/png");
        expect(result.width).toBeGreaterThan(0);
    });
});
