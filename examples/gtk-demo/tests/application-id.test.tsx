import { applicationId } from "virtual:gtkx-config";
import * as Gio from "@gtkx/gi/gio";
import type * as Gtk from "@gtkx/gi/gtk";
import { GtkApplication, GtkApplicationWindow } from "@gtkx/jsx/gtk";
import { createRootElement } from "@gtkx/react";
import { render } from "@gtkx/testing";
import { createRef } from "react";
import { expect, it } from "vitest";

const APP_FLAGS = Gio.ApplicationFlags.NON_UNIQUE;

it("exposes the applicationId declared in gtkx.config.ts through virtual:gtkx-config", () => {
    expect(applicationId).toBe("org.gtkx.gtk-demo");
});

it("applies the applicationId passed explicitly", async () => {
    const ref = createRef<Gtk.Application>();

    await render(
        <GtkApplication ref={ref} applicationId={applicationId} flags={APP_FLAGS}>
            <GtkApplicationWindow defaultWidth={400} defaultHeight={300} />
        </GtkApplication>,
        { container: createRootElement() },
    );

    expect(ref.current?.applicationId).toBe("org.gtkx.gtk-demo");
});

it("leaves the applicationId unset when none is passed", async () => {
    const ref = createRef<Gtk.Application>();

    await render(
        <GtkApplication ref={ref} flags={APP_FLAGS}>
            <GtkApplicationWindow defaultWidth={400} defaultHeight={300} />
        </GtkApplication>,
        { container: createRootElement() },
    );

    expect(ref.current?.applicationId ?? null).toBeNull();
});
