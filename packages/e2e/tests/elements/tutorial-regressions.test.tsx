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
import { render, userEvent, waitFor } from "@gtkx/testing";
import { createRef, type ReactElement, type Ref } from "react";
import { describe, expect, it, vi } from "vitest";

const REUSE_APP_ID = "org.gtkx.tutorial-reuse";

const headerStart = (buttonRef: Ref<Gtk.Button | null>, detail: boolean): ReactElement => {
    if (detail) return <GtkButton ref={buttonRef} iconName="go-previous-symbolic" onClicked={() => {}} />;

    return (
        <>
            <GtkButton ref={buttonRef} iconName="list-add-symbolic" actionName="win.new" />
            <GtkButton iconName="system-search-symbolic" onClicked={() => {}} />
        </>
    );
};

const ReuseShell = ({ buttonRef, detail }: { buttonRef: Ref<Gtk.Button | null>; detail: boolean }) => (
    <AdwApplication applicationId={REUSE_APP_ID} flags={Gio.ApplicationFlags.NON_UNIQUE}>
        <AdwApplicationWindow actions={<GSimpleAction name="new" onActivate={() => {}} />}>
            <AdwToolbarView topBar={<AdwHeaderBar start={headerStart(buttonRef, detail)} />}>
                <GtkLabel>Body</GtkLabel>
            </AdwToolbarView>
        </AdwApplicationWindow>
    </AdwApplication>
);

describe("tutorial regressions", () => {
    it("quits the application when the window close-request handler calls quit()", async () => {
        const appRef = createRef<Adw.Application>();
        const windowRef = createRef<Adw.ApplicationWindow>();

        await render(
            <AdwApplication
                ref={appRef}
                applicationId="org.gtkx.tutorial-close"
                flags={Gio.ApplicationFlags.NON_UNIQUE}
            >
                <AdwApplicationWindow ref={windowRef} onCloseRequest={() => quit()}>
                    <GtkLabel>Body</GtkLabel>
                </AdwApplicationWindow>
            </AdwApplication>,
            { container: rootElement },
        );

        const app = appRef.current;
        if (!app) throw new Error("application was not captured");
        const shutdownHandler = vi.fn();
        app.on("shutdown", shutdownHandler);
        windowRef.current?.emit("close-request");
        await waitFor(() => expect(shutdownHandler).toHaveBeenCalledTimes(1));
    });

    it("keeps the details back button enabled and clickable", async () => {
        const buttonRef = createRef<Gtk.Button>();
        const onBack = vi.fn();

        await render(
            <AdwNavigationSplitView
                content={(
                    <AdwNavigationPage title="Details">
                        <AdwToolbarView
                            topBar={(
                                <AdwHeaderBar
                                    start={
                                        <GtkButton ref={buttonRef} iconName="go-previous-symbolic" onClicked={onBack} />
                                    }
                                />
                            )}
                        >
                            <GtkLabel>Detail body</GtkLabel>
                        </AdwToolbarView>
                    </AdwNavigationPage>
                )}
            />,
        );

        expect(buttonRef.current?.getSensitive()).toBe(true);
        if (buttonRef.current) await userEvent.click(buttonRef.current);
        expect(onBack).toHaveBeenCalledTimes(1);
    });

    it("keeps a reused header start button sensitive after replacing actionName with onClicked", async () => {
        const buttonRef = createRef<Gtk.Button>();

        const { rerender } = await render(<ReuseShell buttonRef={buttonRef} detail={false} />, {
            container: rootElement,
        });

        expect(buttonRef.current?.getSensitive()).toBe(true);
        await rerender(<ReuseShell buttonRef={buttonRef} detail={true} />);
        expect(buttonRef.current?.getSensitive()).toBe(true);
    });
});
