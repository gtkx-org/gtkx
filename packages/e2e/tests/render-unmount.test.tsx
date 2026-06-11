import { whenStopped } from "@gtkx/ffi";
import * as Gio from "@gtkx/gi/gio";
import { GtkApplication, GtkApplicationWindow } from "@gtkx/jsx/gtk";
import { render } from "@gtkx/react";
import { describe, expect, it, vi } from "vitest";
import { setupRealRenderEnvironment } from "./helpers/real-render-environment.js";

setupRealRenderEnvironment();

describe("RenderHandle.unmount", () => {
    it("stops the runtime when the unmounted tree contains the application component", async () => {
        const stopHandler = vi.fn();
        whenStopped().then(stopHandler);

        const handle = render(
            <GtkApplication applicationId="org.gtkx.render-unmount" flags={Gio.ApplicationFlags.NON_UNIQUE}>
                <GtkApplicationWindow defaultWidth={50} defaultHeight={50} />
            </GtkApplication>,
        );
        await new Promise((resolve) => setTimeout(resolve, 0));

        handle.unmount();
        await new Promise((resolve) => setTimeout(resolve, 100));

        expect(stopHandler).toHaveBeenCalledTimes(1);
    });
});
