import type { ReactNode } from "react";
import * as Gdk from "@gtkx/gi/gdk";
import * as GObject from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import {
    GtkBox,
    GtkButton,
    GtkCheckButton,
    GtkDropDown,
    GtkDropTarget,
    GtkEntry,
    GtkEventControllerMotion,
    GtkGestureDrag,
    GtkGestureLongPress,
    GtkLabel,
    GtkListBox,
    GtkListBoxRow,
    GtkScale,
    GtkScrolledWindow,
    GtkShortcutTrigger,
    GtkStack,
    GtkStackPage,
    GtkSwitch,
    GtkWindow,
} from "@gtkx/jsx/gtk";
import { rootElement } from "@gtkx/react";
import { act, configure, getConfig, render, screen, userEvent, waitFor } from "@gtkx/testing";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createRef, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, onTestFinished } from "vitest";
import {
    callCounter,
    renderDragAndDropPair,
    renderGesturedLabel,
    renderShortcutHost,
    returningCallCounter,
} from "./event-render-setup.js";

const initialConfig = { ...getConfig() };
const liveDrags: Set<object> = new Set();
const FOREIGN_ACTIVATION_TIMEOUT = 20_000;

const FOREIGN_CLIENT_SOURCE = [
    'import * as Gtk from "@gtkx/gi/gtk";',
    'new Gtk.Window({ title: "Foreign client", defaultWidth: 160, defaultHeight: 120 }).present();',
    "process.stdin.resume();",
].join("\n");

const setupShortTimeout = (): void => {
    beforeEach(() => {
        configure({ actionabilityTimeout: 60 });
    });

    afterEach(() => {
        configure(initialConfig);
    });
};

const renderInsensitiveGesturedLabel = (name: string, label: string, gesture: ReactNode): Promise<Gtk.Widget> =>
    renderGesturedLabel(name, label, gesture, false);

const renderRemovableButton = async () => {
    const clicks = callCounter();
    const removableRef = createRef<Gtk.Button>();

    const Toggler = (): ReactNode => {
        const [isRemovableShown, setIsRemovableShown] = useState(true);

        return (
            <GtkBox orientation={Gtk.Orientation.VERTICAL}>
                <GtkButton
                    label="Remove"
                    onClicked={() => {
                        setIsRemovableShown(false);
                    }}
                />
                {isRemovableShown && (
                    <GtkButton ref={removableRef} label="Removable" onClicked={clicks.callback} />
                )}
            </GtkBox>
        );
    };

    await render(<Toggler />);
    const removable = removableRef.current as Gtk.Button;
    await userEvent.click(await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Remove" }));

    return { clicks, removable };
};

const MainWindow = ({ onClick, children }: { onClick: () => void; children?: ReactNode }): ReactNode => (
    <GtkWindow title="Main" defaultWidth={200} defaultHeight={140}>
        <GtkBox orientation={Gtk.Orientation.VERTICAL}>
            <GtkButton label="Bump main" onClicked={onClick} />
            <GtkEntry text="before" />
            {children}
        </GtkBox>
    </GtkWindow>
);

const renderMainWindow = async (tree: (onClick: () => void) => ReactNode) => {
    const clicks = callCounter();
    await render(tree(clicks.callback), { container: rootElement });
    const mainButton = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Bump main" });

    return { clicks, mainButton };
};

const findMappedWindow = async (name: string): Promise<Gtk.Window> => {
    const window = await screen.findByRole(Gtk.AccessibleRole.WINDOW, { name, as: Gtk.Window });

    await waitFor(() => {
        expect(window.getMapped()).toBe(true);
    });

    return window;
};

const renderSoleMainWindow = async () => {
    const rendered = await renderMainWindow((onClick) => <MainWindow onClick={onClick} />);

    return { ...rendered, main: await findMappedWindow("Main") };
};

const renderHiddenMainWindow = async () => {
    const rendered = await renderSoleMainWindow();

    await act(() => {
        rendered.main.setVisible(false);
    });

    return rendered;
};

const renderBackgroundedMainWindow = async () => {
    const rendered = await renderMainWindow((onClick) => (
        <>
            <MainWindow onClick={onClick} />
            <GtkWindow title="Extra" defaultWidth={200} defaultHeight={140}>
                <GtkLabel>Second window</GtkLabel>
            </GtkWindow>
        </>
    ));

    const main = await findMappedWindow("Main");
    const extra = await findMappedWindow("Extra");

    await act(() => {
        extra.present();
    });

    await waitFor(() => {
        expect(extra.isActive()).toBe(true);
        expect(main.isActive()).toBe(false);
    });

    return rendered;
};

const withActivationHeldOutsideThisProcess = async (window: Gtk.Window, body: () => Promise<void>): Promise<void> => {
    const foreign = spawn(process.execPath, ["--input-type=module", "--eval", FOREIGN_CLIENT_SOURCE], {
        cwd: import.meta.dirname,
        stdio: ["pipe", "ignore", "ignore"],
    });
    const closed = once(foreign, "close");

    try {
        await waitFor(
            () => {
                expect(window.isActive()).toBe(false);
            },
            {
                timeout: FOREIGN_ACTIVATION_TIMEOUT,
                onTimeout: () =>
                    new Error("the window of the client spawned outside this process never took activation"),
            },
        );

        await body();
    } finally {
        foreign.kill("SIGKILL");
        await closed;
    }
};

const beginDrag = (window: Gtk.Window): Gdk.Drag => {
    const device = window.getDisplay().getDefaultSeat()?.getPointer() ?? null;

    if (device === null) {
        throw new Error("the display has no pointer to drag with");
    }

    const content = Gdk.ContentProvider.newForValue("payload");
    const surface = window.getSurface();

    if (surface === null) {
        throw new Error("the window has no surface to drag from");
    }

    const drag = Gdk.Drag.begin(surface, device, content, Gdk.DragAction.COPY, 0, 0);

    if (drag === null) {
        throw new Error("the display refused to begin a drag");
    }

    return drag;
};

const showDragIcon = async (): Promise<Gtk.DragIcon> => {
    await render(
        <GtkWindow title="Icon host" defaultWidth={200} defaultHeight={140}>
            <GtkLabel>Host</GtkLabel>
        </GtkWindow>,
        { container: rootElement },
    );

    const drag = beginDrag(await findMappedWindow("Icon host"));
    const icon = Gtk.DragIcon.getForDrag(drag);
    liveDrags.add(drag).add(icon);

    onTestFinished(() => {
        drag.dropDone(false);
    });

    return icon;
};

const renderDragIconButton = async (isButtonVisible: boolean) => {
    const clicks = callCounter();
    const buttonRef = createRef<Gtk.Button>();
    const icon = await showDragIcon();

    await render(<GtkButton ref={buttonRef} label="Dragged" visible={isButtonVisible} onClicked={clicks.callback} />, {
        container: icon,
    });

    const button = buttonRef.current as Gtk.Button;
    expect(button.getRoot()).toBe(icon);

    return { button, clicks };
};

const renderModalDialog = async (dialogContent: ReactNode) => {
    const rendered = await renderMainWindow((onClick) => (
        <MainWindow onClick={onClick}>
            <GtkWindow title="Dialog" modal defaultWidth={160} defaultHeight={100}>
                {dialogContent}
            </GtkWindow>
        </MainWindow>
    ));

    return { ...rendered, dialog: await findMappedWindow("Dialog") };
};

describe("userEvent actionability - insensitive targets", () => {
    setupShortTimeout();

    it("refuses every pointer helper on an insensitive button, and on one inside an insensitive box", async () => {
        const clicks = callCounter();
        await render(<GtkButton label="Disabled" sensitive={false} onClicked={clicks.callback} />);
        const button = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Disabled" });
        await expect(userEvent.click(button)).rejects.toThrow();
        await expect(userEvent.dblClick(button)).rejects.toThrow();
        await expect(userEvent.pointer(button, "click")).rejects.toThrow();
        await expect(userEvent.tab(button)).rejects.toThrow();
        expect(clicks.count).toBe(0);
        const nestedClicks = callCounter();

        await render(
            <GtkBox sensitive={false}>
                <GtkButton label="Nested" onClicked={nestedClicks.callback} />
            </GtkBox>,
        );

        const nested = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Nested" });
        await expect(userEvent.click(nested)).rejects.toThrow();
        expect(nestedClicks.count).toBe(0);
    });

    it("refuses to toggle an insensitive switch or checkbox", async () => {
        await render(
            <GtkBox orientation={Gtk.Orientation.VERTICAL}>
                <GtkSwitch sensitive={false} />
                <GtkCheckButton label="Option" sensitive={false} />
            </GtkBox>,
        );

        const toggle = await screen.findByRole(Gtk.AccessibleRole.SWITCH, { as: Gtk.Switch });
        const checkbox = await screen.findByRole(Gtk.AccessibleRole.CHECKBOX, { as: Gtk.CheckButton });
        await expect(userEvent.click(toggle)).rejects.toThrow();
        await expect(userEvent.click(checkbox)).rejects.toThrow();
        expect(toggle.getActive()).toBe(false);
        expect(checkbox.getActive()).toBe(false);
    });

    it("refuses to type into, clear or paste into an insensitive entry", async () => {
        await render(<GtkEntry sensitive={false} text="before" />);
        const entry = await screen.findByRole(Gtk.AccessibleRole.TEXT_BOX, { as: Gtk.Entry });
        await expect(userEvent.type(entry, "typed")).rejects.toThrow();
        await expect(userEvent.clear(entry)).rejects.toThrow();
        await expect(userEvent.paste(entry, "pasted")).rejects.toThrow();
        expect(entry.getText()).toBe("before");
    });

    it("refuses to slide or scroll an insensitive adjustment target", async () => {
        await render(<GtkScale sensitive={false} />);
        const scale = await screen.findByRole(Gtk.AccessibleRole.SLIDER, { as: Gtk.Scale });
        const before = scale.getValue();
        await expect(userEvent.slide(scale, 45)).rejects.toThrow();
        expect(scale.getValue()).toBe(before);
        const ref = createRef<Gtk.ScrolledWindow>();

        await render(
            <GtkScrolledWindow ref={ref} sensitive={false} minContentHeight={200}>
                <GtkBox orientation={Gtk.Orientation.VERTICAL} heightRequest={2000}>
                    <GtkLabel>content</GtkLabel>
                </GtkBox>
            </GtkScrolledWindow>,
        );

        const scrolledWindow = ref.current as Gtk.ScrolledWindow;
        await expect(userEvent.scroll(scrolledWindow, { y: 100 })).rejects.toThrow();
        expect(scrolledWindow.getVadjustment().getValue()).toBe(0);
    });

    it("refuses to select or deselect on an insensitive drop-down or list box", async () => {
        await render(
            <GtkBox sensitive={false}>
                <GtkDropDown model={Gtk.StringList.new(["Option A", "Option B"])} />
            </GtkBox>,
        );

        const dropdown = await screen.findByRole(Gtk.AccessibleRole.COMBO_BOX, { as: Gtk.DropDown });
        const before = dropdown.getSelected();
        await expect(userEvent.selectOptions(dropdown, 1)).rejects.toThrow();
        expect(dropdown.getSelected()).toBe(before);

        await render(
            <GtkListBox sensitive={false} selectionMode={Gtk.SelectionMode.MULTIPLE}>
                <GtkListBoxRow>
                    <GtkLabel>Item 1</GtkLabel>
                </GtkListBoxRow>
            </GtkListBox>,
        );

        await expect(userEvent.deselectOptions(await screen.findByRole(Gtk.AccessibleRole.LIST), 0)).rejects.toThrow();
    });

    it("refuses keyboard input on an insensitive shortcut host without activating its shortcut", async () => {
        const trigger = <GtkShortcutTrigger accelerator="F5" />;
        const { host, activations } = await renderShortcutHost({ trigger, isSensitive: false });
        await expect(userEvent.keyboard(host, "{F5}")).rejects.toThrow();
        expect(activations.count).toBe(0);
    });

    it("refuses every gesture helper on an insensitive widget without emitting its signals", async () => {
        const enters = callCounter();

        const hovered = await renderInsensitiveGesturedLabel(
            "hovered",
            "Hover me",
            <GtkEventControllerMotion onEnter={enters.callback} />,
        );

        await expect(userEvent.hover(hovered)).rejects.toThrow();
        expect(enters.count).toBe(0);
        const presses = callCounter();

        const pressed = await renderInsensitiveGesturedLabel(
            "long-pressed",
            "Long press me",
            <GtkGestureLongPress onPressed={presses.callback} />,
        );

        await expect(userEvent.longPress(pressed)).rejects.toThrow();
        expect(presses.count).toBe(0);
        const dragBegins = callCounter();

        const dragged = await renderInsensitiveGesturedLabel(
            "dragged",
            "Drag me",
            <GtkGestureDrag onDragBegin={dragBegins.callback} />,
        );

        await expect(userEvent.drag(dragged, 10, 10)).rejects.toThrow();
        expect(dragBegins.count).toBe(0);
    });

    it("refuses to drop onto an insensitive target and to drag from an insensitive source", async () => {
        const drops = returningCallCounter(true);

        const target = await renderInsensitiveGesturedLabel(
            "drop-zone",
            "Drop here",
            <GtkDropTarget types={[GObject.TYPE_STRING]} actions={Gdk.DragAction.COPY} onDrop={drops.callback} />,
        );

        await expect(userEvent.drop(target, "payload")).rejects.toThrow();
        const pair = await renderDragAndDropPair({ onDrop: drops.callback, isSourceSensitive: false });
        await expect(userEvent.dragAndDrop(pair.source, pair.target, "payload")).rejects.toThrow();
        expect(drops.count).toBe(0);
    });
});

describe("userEvent actionability - targets outside a mapped toplevel", () => {
    setupShortTimeout();

    it("refuses a widget whose conditional render was removed", async () => {
        const { clicks, removable } = await renderRemovableButton();
        expect(removable.getRoot()).toBeNull();
        await expect(userEvent.click(removable)).rejects.toThrow();
        expect(clicks.count).toBe(0);
    });

    it("refuses a widget rendered into a container that is outside any window", async () => {
        const box = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL });
        const entryRef = createRef<Gtk.Entry>();
        await render(<GtkEntry ref={entryRef} text="before" />, { container: box });
        const entry = entryRef.current as Gtk.Entry;
        expect(entry.getRoot()).toBeNull();
        await expect(userEvent.type(entry, "typed")).rejects.toThrow();
        expect(entry.getText()).toBe("before");
    });

    it("refuses a widget whose render was unmounted", async () => {
        const clicks = callCounter();
        const buttonRef = createRef<Gtk.Button>();
        const { unmount } = await render(<GtkButton ref={buttonRef} label="Gone" onClicked={clicks.callback} />);
        const button = buttonRef.current as Gtk.Button;
        await unmount();
        expect(button.getRoot()).toBeNull();
        await expect(userEvent.click(button)).rejects.toThrow();
        expect(clicks.count).toBe(0);
    });

    it("refuses a widget on a stack page that is not visible", async () => {
        const clicks = callCounter();
        const concealedRef = createRef<Gtk.Button>();

        await render(
            <GtkStack>
                <GtkStackPage name="shown-page">
                    <GtkButton label="Shown" />
                </GtkStackPage>
                <GtkStackPage name="hidden-page">
                    <GtkButton ref={concealedRef} label="Concealed" onClicked={clicks.callback} />
                </GtkStackPage>
            </GtkStack>,
        );

        await userEvent.click(await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Shown" }));
        expect(screen.queryByRole(Gtk.AccessibleRole.BUTTON, { name: "Concealed", hidden: true })).toBeNull();
        await expect(userEvent.click(concealedRef.current as Gtk.Button)).rejects.toThrow();
        expect(clicks.count).toBe(0);
    });

    it("refuses a button whose window is hidden, and clicks it once the window is shown again", async () => {
        const { clicks, main, mainButton } = await renderHiddenMainWindow();
        await expect(userEvent.click(mainButton)).rejects.toThrow();
        expect(clicks.count).toBe(0);

        await act(() => {
            main.present();
        });

        await userEvent.click(mainButton);
        expect(clicks.count).toBe(1);
    });

    it("clicks inside a drag icon, whose root is no window", async () => {
        const { button, clicks } = await renderDragIconButton(true);

        await waitFor(() => {
            expect(button.getMapped()).toBe(true);
        });

        await userEvent.click(button);
        expect(clicks.count).toBe(1);
    });

    it("refuses an unmapped button inside a drag icon", async () => {
        const { button, clicks } = await renderDragIconButton(false);
        await expect(userEvent.click(button)).rejects.toThrow();
        expect(clicks.count).toBe(0);
    });
});

describe("userEvent actionability - background toplevels", () => {
    it("drives a window another toplevel of this process has taken the activation from", async () => {
        const { clicks, mainButton } = await renderBackgroundedMainWindow();
        await userEvent.click(mainButton);
        const entry = await screen.findByRole(Gtk.AccessibleRole.TEXT_BOX, { as: Gtk.Entry });
        await userEvent.type(entry, "typed");
        expect(clicks.count).toBe(1);
        expect(entry.getText()).toBe("beforetyped");
    });

    it("drives a window a client outside this process has taken the activation from", async () => {
        const { clicks, main, mainButton } = await renderSoleMainWindow();
        const entry = await screen.findByRole(Gtk.AccessibleRole.TEXT_BOX, { as: Gtk.Entry });

        await withActivationHeldOutsideThisProcess(main, async () => {
            await userEvent.click(mainButton);
            await userEvent.type(entry, "typed");
        });

        expect(clicks.count).toBe(1);
        expect(entry.getText()).toBe("beforetyped");
    });
});

describe("userEvent actionability - modal toplevels", () => {
    setupShortTimeout();

    it("refuses a window a modal toplevel holds the grab over", async () => {
        const { clicks, mainButton } = await renderModalDialog(<GtkLabel>Blocking</GtkLabel>);
        await expect(userEvent.click(mainButton)).rejects.toThrow();
        expect(clicks.count).toBe(0);
    });

    it("drives the modal toplevel itself", async () => {
        const confirmations = callCounter();
        await renderModalDialog(<GtkButton label="Confirm" onClicked={confirmations.callback} />);
        await userEvent.click(await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Confirm" }));
        expect(confirmations.count).toBe(1);
    });

    it("drives a window a modal toplevel of another window group cannot grab", async () => {
        const { dialog, clicks, mainButton } = await renderModalDialog(<GtkLabel>Blocking</GtkLabel>);

        await act(() => {
            Gtk.WindowGroup.new().addWindow(dialog);
        });

        await userEvent.click(mainButton);
        expect(clicks.count).toBe(1);
    });

    it("drives a modal toplevel stacked on another modal toplevel", async () => {
        const confirmations = callCounter();

        const { dialog } = await renderModalDialog(
            <GtkBox orientation={Gtk.Orientation.VERTICAL}>
                <GtkLabel>Blocking</GtkLabel>
                <GtkWindow title="Nested" modal defaultWidth={120} defaultHeight={80}>
                    <GtkButton label="Confirm" onClicked={confirmations.callback} />
                </GtkWindow>
            </GtkBox>,
        );

        const nested = await findMappedWindow("Nested");
        expect(nested.getTransientFor()).toBe(dialog);
        await userEvent.click(await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Confirm" }));
        expect(confirmations.count).toBe(1);
    });
});

describe("userEvent actionability - ready widgets", () => {
    it("dispatches repeatedly on a mapped, sensitive widget", async () => {
        const clicks = callCounter();
        await render(<GtkButton label="Ready" onClicked={clicks.callback} />);
        const button = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Ready" });
        await userEvent.click(button);
        await userEvent.click(button);
        expect(clicks.count).toBe(2);
    });
});
