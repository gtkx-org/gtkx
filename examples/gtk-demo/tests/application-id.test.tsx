import * as Gio from "@gtkx/gi/gio";
import type * as Gtk from "@gtkx/gi/gtk";
import { GtkApplication, GtkApplicationWindow } from "@gtkx/jsx/gtk";
import { render } from "@gtkx/testing";
import { createRef } from "react";
import { expect, it } from "vitest";

const APP_FLAGS = Gio.ApplicationFlags.NON_UNIQUE;

it("defaults the applicationId to the one declared in gtkx.config.ts", async () => {
    const ref = createRef<Gtk.Application>();

    await render(
        <GtkApplication ref={ref} flags={APP_FLAGS}>
            <GtkApplicationWindow defaultWidth={400} defaultHeight={300} />
        </GtkApplication>,
        { wrapper: false },
    );

    expect(ref.current?.applicationId).toBe("org.gtkx.gtk-demo");
});

it("prefers an explicit applicationId prop over the configured one", async () => {
    const ref = createRef<Gtk.Application>();

    await render(
        <GtkApplication ref={ref} applicationId="org.gtkx.explicit" flags={APP_FLAGS}>
            <GtkApplicationWindow defaultWidth={400} defaultHeight={300} />
        </GtkApplication>,
        { wrapper: false },
    );

    expect(ref.current?.applicationId).toBe("org.gtkx.explicit");
});
