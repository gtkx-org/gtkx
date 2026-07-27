import * as Gio from "@gtkx/gi/gio";
import { GtkApplication, GtkApplicationWindow } from "@gtkx/jsx/gtk";
import { rootElement, useApplication } from "@gtkx/react";
import { render } from "@gtkx/testing";
import { useEffect } from "react";
import { describe, expect, it } from "vitest";
import { createAppIdFactory } from "./helpers/unique-name.js";

const uniqueAppId = createAppIdFactory("org.gtkx.useapplicationtest");

const Probe = () => {
    useApplication();

    return null;
};

describe("useApplication", () => {
    it("returns the GTK application provided by ApplicationContext", async () => {
        let captured: unknown = "unset";

        const CapturingProbe = () => {
            const application = useApplication();

            useEffect(() => {
                captured = application;
            }, [application]);

            return <GtkApplicationWindow defaultWidth={100} defaultHeight={100} />;
        };

        await render(
            <GtkApplication applicationId={uniqueAppId()} flags={Gio.ApplicationFlags.NON_UNIQUE}>
                <CapturingProbe />
            </GtkApplication>,
            { container: rootElement },
        );

        expect(captured).not.toBeNull();
        expect(typeof (captured as { register?: unknown }).register).toBe("function");
    });

    it("throws when the ApplicationContext value is null", async () => {
        await expect(render(<Probe />, { container: rootElement })).rejects.toThrow(
            /useApplication must be called within GtkApplication/,
        );
    });
});
