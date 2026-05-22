import { ApplicationContext, GtkApplicationWindow, useApplication } from "@gtkx/react";
import { render } from "@gtkx/testing";
import { describe, expect, it } from "vitest";

describe("useApplication", () => {
    it("returns the GTK application provided by ApplicationContext", async () => {
        let captured: unknown = "unset";

        const Probe = () => {
            captured = useApplication();
            return <GtkApplicationWindow defaultWidth={100} defaultHeight={100} />;
        };

        await render(<Probe />, { wrapper: false });

        expect(captured).not.toBeNull();
        expect(typeof (captured as { register?: unknown }).register).toBe("function");
    });

    it("throws when the ApplicationContext value is null", async () => {
        const Probe = () => {
            useApplication();
            return null;
        };

        await expect(
            render(
                <ApplicationContext.Provider value={null}>
                    <Probe />
                </ApplicationContext.Provider>,
                { wrapper: false },
            ),
        ).rejects.toThrow(/useApplication must be called within Application/);
    });
});
