import type * as Adw from "@gtkx/gi/adw";
import type * as Gtk from "@gtkx/gi/gtk";
import * as Gio from "@gtkx/gi/gio";
import {
    AdwApplication,
    AdwApplicationWindow,
    AdwHeaderBar,
    AdwNavigationPage,
    AdwNavigationSplitView,
    AdwToolbarView,
} from "@gtkx/jsx/adw";
import { GSimpleAction } from "@gtkx/jsx/gio";
import { GtkButton, GtkLabel } from "@gtkx/jsx/gtk";
import { quit, rootElement } from "@gtkx/react";
import { act, render, userEvent, waitFor } from "@gtkx/testing";
import { createRef, type ReactElement, type Ref } from "react";
import { describe, expect, it, vi } from "vitest";

const REUSE_APP_ID = "org.gtkx.tutorial-reuse";

const headerStart = (buttonRef: Ref<Gtk.Button | null>, isDetail: boolean): ReactElement => {
    if (isDetail) {
        return <GtkButton ref={buttonRef} iconName="go-previous-symbolic" onClicked={vi.fn()} />;
    }

    return (
        <>
            <GtkButton ref={buttonRef} iconName="list-add-symbolic" actionName="win.new" />
            <GtkButton iconName="system-search-symbolic" onClicked={vi.fn()} />
        </>
    );
};

const ReuseShell = ({ buttonRef, isDetail }: { buttonRef: Ref<Gtk.Button | null>; isDetail: boolean }) => (
    <AdwApplication applicationId={REUSE_APP_ID} flags={Gio.ApplicationFlags.NON_UNIQUE}>
        <AdwApplicationWindow actions={<GSimpleAction name="new" onActivate={vi.fn()} />}>
            <AdwToolbarView topBar={<AdwHeaderBar start={headerStart(buttonRef, isDetail)} />}>
                <GtkLabel>Body</GtkLabel>
            </AdwToolbarView>
        </AdwApplicationWindow>
    </AdwApplication>
);

const closeShell = (
    appRef: Ref<Adw.Application | null>,
    windowRef: Ref<Adw.ApplicationWindow | null>,
): ReactElement => (
    <AdwApplication ref={appRef} applicationId="org.gtkx.tutorial-close" flags={Gio.ApplicationFlags.NON_UNIQUE}>
        <AdwApplicationWindow ref={windowRef} onCloseRequest={() => quit()}>
            <GtkLabel>Body</GtkLabel>
        </AdwApplicationWindow>
    </AdwApplication>
);

const detailShell = (buttonRef: Ref<Gtk.Button | null>, onBack: () => void): ReactElement => (
    <AdwNavigationSplitView>
        <AdwNavigationPage title="Details">
            <AdwToolbarView
                topBar={(
                    <AdwHeaderBar
                        start={<GtkButton ref={buttonRef} iconName="go-previous-symbolic" onClicked={onBack} />}
                    />
                )}
            >
                <GtkLabel>Detail body</GtkLabel>
            </AdwToolbarView>
        </AdwNavigationPage>
    </AdwNavigationSplitView>
);

describe("tutorial regressions", () => {
    it("quits the application when the window close-request handler calls quit()", async () => {
        const appRef = createRef<Adw.Application>();
        const windowRef = createRef<Adw.ApplicationWindow>();
        await render(closeShell(appRef, windowRef), { container: rootElement });
        const app = appRef.current;

        if (!app) {
            throw new Error("application was not captured");
        }

        const shutdownHandler = vi.fn();
        app.on("shutdown", shutdownHandler);

        await act(() => {
            windowRef.current?.emit("close-request");
        });

        await waitFor(() => {
            expect(shutdownHandler).toHaveBeenCalledTimes(1);
        });
    });

    it("keeps the details back button enabled and clickable", async () => {
        const buttonRef = createRef<Gtk.Button>();
        const onBack = vi.fn();
        await render(detailShell(buttonRef, onBack));
        expect(buttonRef.current).toBeEnabled();

        if (buttonRef.current) {
            await userEvent.click(buttonRef.current);
        }

        expect(onBack).toHaveBeenCalledTimes(1);
    });

    it("keeps a reused header start button sensitive after replacing actionName with onClicked", async () => {
        const buttonRef = createRef<Gtk.Button>();

        const { rerender } = await render(<ReuseShell buttonRef={buttonRef} isDetail={false} />, {
            container: rootElement,
        });

        expect(buttonRef.current).toBeEnabled();
        await rerender(<ReuseShell buttonRef={buttonRef} isDetail={true} />);
        expect(buttonRef.current).toBeEnabled();
    });
});
