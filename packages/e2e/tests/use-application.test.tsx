import { GtkApplicationWindow } from "@gtkx/jsx/gtk";
import { rootElement, useApplication } from "@gtkx/react";
import { render } from "@gtkx/testing";
import { useEffect } from "react";
import { describe, expect, it } from "vitest";
import { createApplicationRenderer } from "./helpers/application-render.js";

const renderApplication = createApplicationRenderer("org.gtkx.useapplicationtest");

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

        await renderApplication(<CapturingProbe />);
        expect(captured).not.toBeNull();
        expect(typeof (captured as { register?: unknown }).register).toBe("function");
    });

    it("throws when the ApplicationContext value is null", async () => {
        await expect(render(<Probe />, { container: rootElement })).rejects.toThrow(
            /useApplication must be called within GtkApplication/,
        );
    });
});
