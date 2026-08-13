import type * as Gtk from "@gtkx/gi/gtk";
import * as Gio from "@gtkx/gi/gio";
import { GSimpleAction } from "@gtkx/jsx/gio";
import { GtkApplication, GtkApplicationWindow, GtkLabel } from "@gtkx/jsx/gtk";
import { rootElement } from "@gtkx/react";
import { createApplication, runApplication } from "@gtkx/runtime";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { cleanup, render, screen } from "../src/index.js";

const APPLICATION_ID = "org.gtkx.defaultapplication";

const Probe = () => {
    const [count, setCount] = useState(0);

    const bump = (): void => {
        setCount((current) => current + 1);
    };

    return (
        <GtkApplication
            applicationId={APPLICATION_ID}
            flags={Gio.ApplicationFlags.NON_UNIQUE}
            actions={<GSimpleAction name="bump" onActivate={bump} />}
        >
            <GtkApplicationWindow defaultWidth={100} defaultHeight={100}>
                <GtkLabel name="count">{`Count: ${String(count)}`}</GtkLabel>
            </GtkApplicationWindow>
        </GtkApplication>
    );
};

const renderProbe = async (): Promise<Gtk.Application> => {
    await render(<Probe />, { container: rootElement });
    const label = await screen.findByName("count");
    const application = (label.getRoot() as Gtk.ApplicationWindow).getApplication();

    if (application === null) {
        throw new Error("the rendered window was never attached to an application");
    }

    return application;
};

const renderAfterCleanup = async (): Promise<Gtk.Application> => {
    await renderProbe();
    await cleanup();

    return renderProbe();
};

describe("Gio.Application.getDefault", () => {
    it("hands back the mounted application on every render, not the first one built", async () => {
        const first = await renderProbe();
        expect(Gio.Application.getDefault()).toBe(first);
        await cleanup();
        const second = await renderProbe();
        expect(second).not.toBe(first);
        expect(Gio.Application.getDefault()).toBe(second);
        expect(second.getIsRegistered()).toBe(true);
    });

    it("activates an action through the application the current render started", async () => {
        await renderAfterCleanup();
        const current = Gio.Application.getDefault();
        expect(current?.listActions()).toContain("bump");
        current?.activateAction("bump", null);
        expect(await screen.findByText("Count: 1")).toBeDefined();
    });

    it("hands back nothing once cleanup has torn the render down", async () => {
        await renderProbe();
        await cleanup();
        const afterCleanup = Gio.Application.getDefault();
        expect(afterCleanup?.listActions()).toBeUndefined();
        expect(afterCleanup).toBeNull();
    });

    it("never hands back an application whose start left it unregistered", () => {
        const application = createApplication(Gio.Application, {
            applicationId: `${APPLICATION_ID}.unstarted`,
            flags: Gio.ApplicationFlags.NON_UNIQUE,
        });

        expect(runApplication(application, ["probe", "--nope"])).toEqual({ isPrimary: false, exitStatus: 1 });
        expect(Gio.Application.getDefault()).not.toBe(application);
    });
});
