import type * as Adw from "@gtkx/gi/adw";
import * as Gio from "@gtkx/gi/gio";
import { AdwApplication, AdwApplicationWindow } from "@gtkx/jsx/adw";
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
    const ref = createRef<Adw.Application>();

    await render(
        <AdwApplication ref={ref} applicationId="org.gtkx.explicit" flags={APP_FLAGS}>
            <AdwApplicationWindow defaultWidth={400} defaultHeight={300} />
        </AdwApplication>,
        { container: rootElement },
    );

    expect(ref.current?.applicationId).toBe("org.gtkx.explicit");
    expect(ref.current?.resourceBasePath).toBe("/org/gtkx/gtk-demo");
});

it("honors an explicit resourceBasePath", async () => {
    const ref = createRef<Adw.Application>();

    await render(
        <AdwApplication ref={ref} flags={APP_FLAGS} resourceBasePath="/org/gtkx/custom">
            <AdwApplicationWindow defaultWidth={400} defaultHeight={300} />
        </AdwApplication>,
        { container: rootElement },
    );

    expect(ref.current?.resourceBasePath).toBe("/org/gtkx/custom");
});

it("defaults the applicationId to the config one when none is passed", async () => {
    const ref = createRef<Adw.Application>();

    await render(
        <AdwApplication ref={ref} flags={APP_FLAGS}>
            <AdwApplicationWindow defaultWidth={400} defaultHeight={300} />
        </AdwApplication>,
        { container: rootElement },
    );

    expect(ref.current?.applicationId).toBe("org.gtkx.gtk-demo");
    expect(ref.current?.resourceBasePath).toBe("/org/gtkx/gtk-demo");
});
