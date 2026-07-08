import * as Gio from "@gtkx/gi/gio";
import type * as Gtk from "@gtkx/gi/gtk";
import { GSimpleAction } from "@gtkx/jsx/gio";
import { GtkApplication, GtkApplicationWindow } from "@gtkx/jsx/gtk";
import { rootElement } from "@gtkx/react";

type ActionAccel = { detailedActionName: string; accels: string[] };

import { render } from "@gtkx/testing";
import { createRef, type ReactNode, type RefObject } from "react";
import { describe, expect, it } from "vitest";

const APP_FLAGS = Gio.ApplicationFlags.NON_UNIQUE;

let nextAppId = 0;
const uniqueAppId = (): string => `org.gtkx.actionaccelstest${nextAppId++}`;

const noop = () => {};

const AccelsApp = ({
    appRef,
    appId,
    actionAccels,
    windowActions,
    appActions,
}: {
    appRef: RefObject<Gtk.Application | null>;
    appId: string;
    actionAccels?: ActionAccel[];
    windowActions?: ReactNode;
    appActions?: ReactNode;
}): ReactNode => (
    <GtkApplication ref={appRef} applicationId={appId} flags={APP_FLAGS} actionAccels={actionAccels}>
        {appActions}
        <GtkApplicationWindow defaultWidth={800} defaultHeight={600} actions={windowActions} />
    </GtkApplication>
);

describe("GtkApplication actionAccels", () => {
    it("binds window-scoped accels from the actionAccels prop", async () => {
        const ref = createRef<Gtk.Application>();

        await render(
            <AccelsApp
                appRef={ref}
                appId={uniqueAppId()}
                actionAccels={[{ detailedActionName: "win.new", accels: ["<Control>n"] }]}
                windowActions={<GSimpleAction name="new" onActivate={noop} />}
            />,
            { container: rootElement },
        );

        expect(ref.current?.getAccelsForAction("win.new")).toEqual(["<Control>n"]);
    });

    it("binds application-scoped accels with multiple accelerators", async () => {
        const ref = createRef<Gtk.Application>();

        await render(
            <AccelsApp
                appRef={ref}
                appId={uniqueAppId()}
                actionAccels={[{ detailedActionName: "app.quit", accels: ["<Control>q", "<Control>w"] }]}
                appActions={<GSimpleAction name="quit" onActivate={noop} />}
            />,
            { container: rootElement },
        );

        expect(ref.current?.getAccelsForAction("app.quit")).toEqual(["<Control>q", "<Control>w"]);
    });

    it("clears accels when an entry is removed", async () => {
        const ref = createRef<Gtk.Application>();
        const appId = uniqueAppId();

        const { rerender } = await render(
            <AccelsApp
                appRef={ref}
                appId={appId}
                actionAccels={[{ detailedActionName: "win.new", accels: ["<Control>n"] }]}
                windowActions={<GSimpleAction name="new" onActivate={noop} />}
            />,
            { container: rootElement },
        );
        expect(ref.current?.getAccelsForAction("win.new")).toEqual(["<Control>n"]);

        await rerender(
            <AccelsApp
                appRef={ref}
                appId={appId}
                actionAccels={[]}
                windowActions={<GSimpleAction name="new" onActivate={noop} />}
            />,
        );
        expect(ref.current?.getAccelsForAction("win.new")).toEqual([]);
    });
});
