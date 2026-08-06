import type * as Gtk from "@gtkx/gi/gtk";
import type { ActionAccel } from "@gtkx/react/internal";
import * as Gio from "@gtkx/gi/gio";
import { GSimpleAction } from "@gtkx/jsx/gio";
import { GtkApplication, GtkApplicationWindow } from "@gtkx/jsx/gtk";
import { rootElement } from "@gtkx/react";
import { render } from "@gtkx/testing";
import { createRef, type ReactNode, type RefObject } from "react";
import { describe, expect, it, vi } from "vitest";
import { createAppIdFactory } from "../helpers/unique-name.js";

type AccelsAppProps = {
    appRef: RefObject<Gtk.Application | null>;
    appId: string;
    actionAccels?: ActionAccel[];
    windowActions?: ReactNode;
    appActions?: ReactNode;
};

const APP_FLAGS = Gio.ApplicationFlags.NON_UNIQUE;
const uniqueAppId = createAppIdFactory("org.gtkx.actionaccelstest");
const noop = vi.fn();
const newWindowAction = <GSimpleAction name="new" onActivate={noop} />;

const AccelsApp = ({ appRef, appId, actionAccels, windowActions, appActions }: AccelsAppProps): ReactNode => (
    <GtkApplication
        ref={appRef}
        applicationId={appId}
        flags={APP_FLAGS}
        actionAccels={actionAccels}
        actions={appActions}
    >
        <GtkApplicationWindow defaultWidth={800} defaultHeight={600} actions={windowActions} />
    </GtkApplication>
);

const renderAccels = (props: AccelsAppProps) => render(<AccelsApp {...props} />, { container: rootElement });

const renderWinNewAccels = (appRef: RefObject<Gtk.Application | null>, appId: string) =>
    renderAccels({
        appRef,
        appId,
        actionAccels: [{ detailedActionName: "win.new", accels: ["<Control>n"] }],
        windowActions: newWindowAction,
    });

describe("GtkApplication actionAccels", () => {
    it("binds window-scoped accels from the actionAccels prop", async () => {
        const ref = createRef<Gtk.Application>();
        await renderWinNewAccels(ref, uniqueAppId());
        expect(ref.current?.getAccelsForAction("win.new")).toEqual(["<Control>n"]);
    });

    it("binds application-scoped accels with multiple accelerators", async () => {
        const ref = createRef<Gtk.Application>();

        await renderAccels({
            appRef: ref,
            appId: uniqueAppId(),
            actionAccels: [{ detailedActionName: "app.quit", accels: ["<Control>q", "<Control>w"] }],
            appActions: <GSimpleAction name="quit" onActivate={noop} />,
        });

        expect(ref.current?.getAccelsForAction("app.quit")).toEqual(["<Control>q", "<Control>w"]);
    });

    it("clears accels when an entry is removed", async () => {
        const ref = createRef<Gtk.Application>();
        const appId = uniqueAppId();
        const { rerender } = await renderWinNewAccels(ref, appId);
        expect(ref.current?.getAccelsForAction("win.new")).toEqual(["<Control>n"]);
        await rerender(<AccelsApp appRef={ref} appId={appId} actionAccels={[]} windowActions={newWindowAction} />);
        expect(ref.current?.getAccelsForAction("win.new")).toEqual([]);
    });
});
