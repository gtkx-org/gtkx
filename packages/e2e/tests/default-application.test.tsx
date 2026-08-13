import type * as Gtk from "@gtkx/gi/gtk";
import * as Gio from "@gtkx/gi/gio";
import { GSimpleAction } from "@gtkx/jsx/gio";
import { GtkApplication, GtkApplicationWindow, GtkLabel } from "@gtkx/jsx/gtk";
import { rootElement } from "@gtkx/react";
import { render, screen } from "@gtkx/testing";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { createAppIdFactory } from "./helpers/unique-name.js";

type ProbeProps = { applicationId: string };

const uniqueAppId = createAppIdFactory("org.gtkx.defaultapplication");
const renderedApplications: (Gtk.Application | null)[] = [];

const Probe = ({ applicationId }: ProbeProps) => {
    const [count, setCount] = useState(0);

    const bump = (): void => {
        setCount((current) => current + 1);
    };

    return (
        <GtkApplication
            applicationId={applicationId}
            flags={Gio.ApplicationFlags.NON_UNIQUE}
            actions={<GSimpleAction name="bump" onActivate={bump} />}
        >
            <GtkApplicationWindow defaultWidth={100} defaultHeight={100}>
                <GtkLabel name="count">{`Count: ${String(count)}`}</GtkLabel>
            </GtkApplicationWindow>
        </GtkApplication>
    );
};

const firstApplication = (): Gtk.Application | null | undefined => {
    const [first] = renderedApplications;

    return first;
};

const renderAndReadDefault = async (): Promise<Gio.Application | null> => {
    await render(<Probe applicationId={uniqueAppId()} />, { container: rootElement });
    const label = await screen.findByName("count");
    const window = label.getRoot() as Gtk.ApplicationWindow;
    const application = window.getApplication();
    renderedApplications.push(application);
    const current = Gio.Application.getDefault();
    expect(current).toBe(application);

    return current;
};

const renderAgainAndReadDefault = async (): Promise<Gio.Application | null> => {
    const current = await renderAndReadDefault();
    expect(current).not.toBe(firstApplication());

    return current;
};

describe("Gio.Application.getDefault", () => {
    it("returns the application the first render started", async () => {
        const current = await renderAndReadDefault();
        expect(firstApplication()).toBe(current);
        expect(current?.getIsRegistered()).toBe(true);
    });

    it("returns the application a later render started, not the one cleanup tore down", async () => {
        const current = await renderAgainAndReadDefault();
        expect(current?.getIsRegistered()).toBe(true);
    });

    it("activates an action through the application a later render started", async () => {
        const current = await renderAgainAndReadDefault();
        expect(current?.listActions()).toContain("bump");
        current?.activateAction("bump", null);
        expect(await screen.findByText("Count: 1")).toBeDefined();
    });
});
