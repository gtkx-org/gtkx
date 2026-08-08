import type * as Gtk from "@gtkx/gi/gtk";
import type { ActionAccel } from "@gtkx/react/internal";
import * as Gio from "@gtkx/gi/gio";
import * as GLib from "@gtkx/gi/glib";
import { GSimpleAction } from "@gtkx/jsx/gio";
import { GtkApplication, GtkApplicationWindow, GtkBox, GtkEntry, GtkLabel } from "@gtkx/jsx/gtk";
import { rootElement } from "@gtkx/react";
import { render, userEvent } from "@gtkx/testing";
import { createRef, type ReactNode, type RefObject } from "react";
import { describe, expect, it, vi } from "vitest";
import { createAppIdFactory } from "../helpers/unique-name.js";

type AccelsAppProps = {
    labelRef: RefObject<Gtk.Label | null>;
    entryRef: RefObject<Gtk.Entry | null>;
    actionAccels: ActionAccel[];
    actions: ReactNode;
    isAppScoped: boolean;
};

type ActivateMock = ReturnType<typeof createActivateMock>;

type Harness = {
    label: Gtk.Label;
    entry: Gtk.Entry;
    onActivate: ActivateMock;
};

const APP_FLAGS = Gio.ApplicationFlags.NON_UNIQUE;
const uniqueAppId = createAppIdFactory("org.gtkx.accelkeyboard");

const createActivateMock = () => vi.fn<(parameter: GLib.Variant | null) => void>();

const AccelsApp = ({ labelRef, entryRef, actionAccels, actions, isAppScoped }: AccelsAppProps): ReactNode => (
    <GtkApplication
        applicationId={uniqueAppId()}
        flags={APP_FLAGS}
        actionAccels={actionAccels}
        actions={isAppScoped ? actions : undefined}
    >
        <GtkApplicationWindow
            defaultWidth={400}
            defaultHeight={300}
            actions={isAppScoped ? undefined : actions}
        >
            <GtkBox>
                <GtkLabel ref={labelRef} label="content" selectable />
                <GtkEntry ref={entryRef} text="editable content" />
            </GtkBox>
        </GtkApplicationWindow>
    </GtkApplication>
);

const requireWidget = <T,>(widget: T | null, name: string): T => {
    if (widget === null) {
        throw new Error(`${name} did not render`);
    }

    return widget;
};

const renderHarness = async (
    accels: string[],
    detailedActionName: string,
    action: (onActivate: ActivateMock) => ReactNode,
    isAppScoped = false,
): Promise<Harness> => {
    const labelRef = createRef<Gtk.Label>();
    const entryRef = createRef<Gtk.Entry>();
    const onActivate = createActivateMock();

    await render(
        <AccelsApp
            labelRef={labelRef}
            entryRef={entryRef}
            actionAccels={[{ detailedActionName, accels }]}
            actions={action(onActivate)}
            isAppScoped={isAppScoped}
        />,
        { container: rootElement },
    );

    return {
        label: requireWidget(labelRef.current, "label"),
        entry: requireWidget(entryRef.current, "entry"),
        onActivate,
    };
};

const simpleAction = (name: string) => (onActivate: ActivateMock) => (
    <GSimpleAction name={name} onActivate={onActivate} />
);

const targetedAction = (name: string) => (onActivate: ActivateMock) => (
    <GSimpleAction name={name} parameterType={GLib.VariantType.new("s")} onActivate={onActivate} />
);

describe("userEvent.keyboard dispatches application accelerators", () => {
    it("activates a window-scoped action bound through actionAccels", async () => {
        const { label, onActivate } = await renderHarness(["<Control>s"], "win.save", simpleAction("save"));
        label.grabFocus();
        await userEvent.keyboard(label, "{Control>}s{/Control}");
        expect(onActivate).toHaveBeenCalledTimes(1);
    });

    it("activates an application-scoped action bound through actionAccels", async () => {
        const harness = await renderHarness(["<Control>k"], "app.palette", simpleAction("palette"), true);
        harness.label.grabFocus();
        await userEvent.keyboard(harness.label, "{Control>}k{/Control}");
        expect(harness.onActivate).toHaveBeenCalledTimes(1);
    });

    it("activates an accelerator carrying an action target", async () => {
        const harness = await renderHarness(["<Control><Shift>d"], "app.mode::dark", targetedAction("mode"), true);
        harness.label.grabFocus();
        await userEvent.keyboard(harness.label, "{Control>}{Shift>}d{/Shift}{/Control}");
        expect(harness.onActivate).toHaveBeenCalledTimes(1);
        expect(harness.onActivate.mock.calls[0]?.[0]?.getString()[0]).toBe("dark");
    });
});

describe("userEvent.keyboard prefers application accelerators over local shortcuts", () => {
    it("takes priority over a class shortcut on the focused widget", async () => {
        const { label, onActivate } = await renderHarness(["<Control>f"], "win.find", simpleAction("find"));
        label.grabFocus();
        await userEvent.keyboard(label, "{Control>}f{/Control}");
        expect(onActivate).toHaveBeenCalledTimes(1);
    });

    it("takes priority over a shortcut on an editable's delegate", async () => {
        const action = simpleAction("select-all-items");
        const { entry, onActivate } = await renderHarness(["<Control>a"], "win.select-all-items", action);
        entry.grabFocus();
        entry.selectRegion(0, 0);
        await userEvent.keyboard(entry, "{Control>}a{/Control}");
        expect(onActivate).toHaveBeenCalledTimes(1);
        expect(entry.getSelectionBounds()[0]).toBe(false);
    });

    it("leaves unbound key combinations to the widget's own shortcuts", async () => {
        const { entry, onActivate } = await renderHarness(["<Control>s"], "win.save", simpleAction("save"));
        entry.grabFocus();
        await userEvent.keyboard(entry, "{Control>}a{/Control}");
        expect(onActivate).not.toHaveBeenCalled();
        expect(entry.getSelectionBounds()[0]).toBe(true);
    });
});
