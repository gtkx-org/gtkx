import type * as Gtk from "@gtkx/gi/gtk";
import { GtkApplication, GtkApplicationWindow } from "@gtkx/jsx/gtk";
import { createRoot, type Root, rootElement } from "@gtkx/react";
import { act } from "@gtkx/testing";
import { afterEach, describe, expect, it, vi } from "vitest";
import { startApplicationOwner, stopApplicationOwners } from "./helpers/application-owner.js";
import { createAppIdFactory } from "./helpers/unique-name.js";

type Rendered = {
    output: string;
    windows: number;
};

type Captured = {
    application: Gtk.Application | null;
};

const uniqueAppId = createAppIdFactory("org.gtkx.remoteapp");
const mounted: Root[] = [];

const captureStandardError = (): (() => string) => {
    const chunks: string[] = [];

    vi.spyOn(process.stderr, "write").mockImplementation((chunk: string | Uint8Array): boolean => {
        chunks.push(typeof chunk === "string" ? chunk : Buffer.from(chunk).toString());

        return true;
    });

    return () => chunks.join("");
};

const renderApplication = async (applicationId: string): Promise<Rendered> => {
    const root = createRoot({ ...rootElement });
    mounted.push(root);
    const captured: Captured = { application: null };
    const standardError = captureStandardError();

    await act(() => {
        root.render(
            <GtkApplication
                applicationId={applicationId}
                ref={(application) => {
                    captured.application = application;
                }}
            >
                <GtkApplicationWindow defaultWidth={100} defaultHeight={100} />
            </GtkApplication>,
        );
    });

    return { output: standardError(), windows: captured.application?.getWindows().length ?? 0 };
};

afterEach(async () => {
    const roots = [...mounted];
    mounted.length = 0;
    vi.restoreAllMocks();

    for (const root of roots) {
        await act(() => {
            root.unmount();
        });
    }

    stopApplicationOwners();
});

describe("<GtkApplication> on an application ID another process already owns", () => {
    it("names the application ID the other process holds instead of drawing nothing", async () => {
        const applicationId = uniqueAppId();
        await startApplicationOwner(applicationId);
        const rendered = await renderApplication(applicationId);
        expect(rendered.windows).toBe(0);
        expect(rendered.output).toContain(`Another process already owns ${applicationId}`);
        expect(rendered.output).toContain("can never show a window");
    });

    it("says nothing when this process owns the application ID", async () => {
        const rendered = await renderApplication(uniqueAppId());
        expect(rendered.windows).toBe(1);
        expect(rendered.output).not.toContain("Another process already owns");
    });
});
