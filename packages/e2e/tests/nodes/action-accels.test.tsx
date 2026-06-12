import * as Gio from "@gtkx/gi/gio";
import type * as Gtk from "@gtkx/gi/gtk";
import { GSimpleAction } from "@gtkx/jsx/gio";
import { GtkApplication, GtkApplicationWindow } from "@gtkx/jsx/gtk";
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
    windowActions,
    appActions,
}: {
    appRef: RefObject<Gtk.Application | null>;
    appId: string;
    windowActions?: ReactNode;
    appActions?: ReactNode;
}): ReactNode => (
    <GtkApplication ref={appRef} applicationId={appId} flags={APP_FLAGS}>
        {appActions}
        <GtkApplicationWindow defaultWidth={800} defaultHeight={600} addAction={windowActions} />
    </GtkApplication>
);

describe("GSimpleAction accels", () => {
    it("binds window-scoped accels from the addAction slot", async () => {
        const ref = createRef<Gtk.Application>();

        await render(
            <AccelsApp
                appRef={ref}
                appId={uniqueAppId()}
                windowActions={<GSimpleAction name="new" onActivate={noop} accels="<Control>n" />}
            />,
            { wrapper: false },
        );

        expect(ref.current?.getAccelsForAction("win.new")).toEqual(["<Control>n"]);
    });

    it("clears window accels when the action unmounts", async () => {
        const ref = createRef<Gtk.Application>();
        const appId = uniqueAppId();
        const action = <GSimpleAction name="new" onActivate={noop} accels="<Control>n" />;

        const { rerender } = await render(<AccelsApp appRef={ref} appId={appId} windowActions={action} />, {
            wrapper: false,
        });
        expect(ref.current?.getAccelsForAction("win.new")).toEqual(["<Control>n"]);

        await rerender(<AccelsApp appRef={ref} appId={appId} windowActions={null} />);
        expect(ref.current?.getAccelsForAction("win.new")).toEqual([]);
    });

    it("binds application-scoped accels from application children", async () => {
        const ref = createRef<Gtk.Application>();

        await render(
            <AccelsApp
                appRef={ref}
                appId={uniqueAppId()}
                appActions={<GSimpleAction name="quit" onActivate={noop} accels={["<Control>q", "<Control>w"]} />}
            />,
            { wrapper: false },
        );

        expect(ref.current?.getAccelsForAction("app.quit")).toEqual(["<Control>q", "<Control>w"]);
    });
});
