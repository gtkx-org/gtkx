import type * as Gtk from "@gtkx/gi/gtk";
import * as Gio from "@gtkx/gi/gio";
import { GtkApplication, GtkApplicationWindow } from "@gtkx/jsx/gtk";
import { rootElement } from "@gtkx/react";
import { render } from "@gtkx/testing";
import { createRef } from "react";
import { applicationId, resourceBasePath } from "virtual:gtkx-config";
import { expect, it } from "vitest";

const APP_FLAGS = Gio.ApplicationFlags.NON_UNIQUE;

it("exposes the application identity declared in gtkx.config.ts through virtual:gtkx-config", () => {
    expect(applicationId).toBe("org.gtkx.gtk-demo");
    expect(resourceBasePath).toBe("/org/gtkx/gtk-demo");
});

it("applies the applicationId passed explicitly", async () => {
    const ref = createRef<Gtk.Application>();

    await render(
        <GtkApplication ref={ref} applicationId="org.gtkx.explicit" flags={APP_FLAGS}>
            <GtkApplicationWindow defaultWidth={400} defaultHeight={300} />
        </GtkApplication>,
        { container: rootElement },
    );

    expect(ref.current?.applicationId).toBe("org.gtkx.explicit");
    expect(ref.current?.resourceBasePath).toBe("/org/gtkx/gtk-demo");
});

it("honors an explicit resourceBasePath", async () => {
    const ref = createRef<Gtk.Application>();

    await render(
        <GtkApplication ref={ref} flags={APP_FLAGS} resourceBasePath="/org/gtkx/custom">
            <GtkApplicationWindow defaultWidth={400} defaultHeight={300} />
        </GtkApplication>,
        { container: rootElement },
    );

    expect(ref.current?.resourceBasePath).toBe("/org/gtkx/custom");
});

it("defaults the applicationId to the config one when none is passed", async () => {
    const ref = createRef<Gtk.Application>();

    await render(
        <GtkApplication ref={ref} flags={APP_FLAGS}>
            <GtkApplicationWindow defaultWidth={400} defaultHeight={300} />
        </GtkApplication>,
        { container: rootElement },
    );

    expect(ref.current?.applicationId).toBe("org.gtkx.gtk-demo");
    expect(ref.current?.resourceBasePath).toBe("/org/gtkx/gtk-demo");
});
