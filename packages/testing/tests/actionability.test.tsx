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
    GtkStack,
    GtkStackPage,
    GtkSwitch,
    GtkWindow,
} from "@gtkx/jsx/gtk";
import { rootElement } from "@gtkx/react";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createRef, type ReactNode, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from "vitest";
import { act, configure, getConfig, render, screen, userEvent, waitFor } from "../src/index.js";
import { renderDragAndDropPair, renderGesturedLabel, renderShortcutHost } from "./event-render-setup.js";

const initialConfig = { ...getConfig() };
const FOREIGN_ACTIVATION_TIMEOUT = 20_000;

const FOREIGN_CLIENT_SOURCE = [
    'import * as Gtk from "@gtkx/gi/gtk";',
    'new Gtk.Window({ title: "Foreign client", defaultWidth: 160, defaultHeight: 120 }).present();',
    "process.stdin.resume();",
].join("\n");

const NOT_SENSITIVE_PATTERN = /did not become actionable within 60ms because it is not sensitive/;
const NOT_ROOTED_PATTERN = /did not become actionable within 60ms because it is not inside a toplevel/;
const WINDOW_HIDDEN_PATTERN = /did not become actionable within 60ms because its window is not visible/;
const MODAL_PATTERN = /did not become actionable within 60ms because its window is blocked by a modal window/;

const INSENSITIVE_BUTTON_ACTIONS: [string, (button: Gtk.Widget) => Promise<unknown>][] = [
    ["click", (button) => userEvent.click(button)],
    ["dblClick", (button) => userEvent.dblClick(button)],
    ["pointer input", (button) => userEvent.pointer(button, "click")],
];

const setupShortTimeout = (): void => {
    beforeEach(() => {
        configure({ actionabilityTimeout: 60 });
    });

    afterEach(() => {
        configure(initialConfig);
    });
};

const renderInsensitiveButton = async () => {
    const handleClick = vi.fn();
    await render(<GtkButton label="Disabled" sensitive={false} onClicked={handleClick} />);
    const button = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Disabled" });

    return { button, handleClick };
};

const expectInsensitiveButtonRejection = async (action: (button: Gtk.Widget) => Promise<unknown>): Promise<void> => {
    const { button, handleClick } = await renderInsensitiveButton();
    await expect(action(button)).rejects.toThrow(NOT_SENSITIVE_PATTERN);
    expect(handleClick).not.toHaveBeenCalled();
};

const renderInsensitiveGesturedLabel = (name: string, label: string, gesture: ReactNode): Promise<Gtk.Widget> =>
    renderGesturedLabel(name, label, gesture, false);

const renderRemovableButton = async () => {
    const handleClick = vi.fn();
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
                {isRemovableShown ? <GtkButton ref={removableRef} label="Removable" onClicked={handleClick} /> : null}
            </GtkBox>
        );
    };

    await render(<Toggler />);
    const removable = removableRef.current as Gtk.Button;
    await userEvent.click(await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Remove" }));

    return { handleClick, removable };
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
    const handleMainClick = vi.fn();
    await render(tree(handleMainClick), { container: rootElement });
    const mainButton = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Bump main" });

    return { handleMainClick, mainButton };
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

    try {
        await waitFor(() => {
            expect(window.isActive()).toBe(false);
        }, {
            timeout: FOREIGN_ACTIVATION_TIMEOUT,
            onTimeout: () => new Error("the window of the client spawned outside this process never took activation"),
        });

        await body();
    } finally {
        foreign.kill("SIGKILL");
        await once(foreign, "close");
    }
};

const beginDrag = (window: Gtk.Window): Gdk.Drag => {
    const device = window.getDisplay().getDefaultSeat()?.getPointer() ?? null;

    if (device === null) {
        throw new Error("the display has no pointer to drag with");
    }

    const content = Gdk.ContentProvider.newForValue(
        GObject.buildValue(GObject.TYPE_STRING, (value) => {
            value.setString("payload");
        }),
    );

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

    onTestFinished(() => {
        drag.dropDone(false);
    });

    return Gtk.DragIcon.getForDrag(drag);
};

const renderDragIconButton = async (isButtonVisible: boolean) => {
    const handleClick = vi.fn();
    const buttonRef = createRef<Gtk.Button>();
    const icon = await showDragIcon();

    await render(<GtkButton ref={buttonRef} label="Dragged" visible={isButtonVisible} onClicked={handleClick} />, {
        container: icon,
    });

    const button = buttonRef.current as Gtk.Button;
    expect(button.getRoot()).toBe(icon);

    return { button, handleClick };
};

const renderModalDialog = async (dialogContent: ReactNode) => {
    const rendered = await renderMainWindow((onClick) => (
        <MainWindow onClick={onClick}>
            <GtkWindow title="Dialog" modal defaultWidth={160} defaultHeight={100}>
                {dialogContent}
            </GtkWindow>
        </MainWindow>
    ));

    const dialog = await findMappedWindow("Dialog");

    return { ...rendered, dialog };
};

describe("userEvent actionability - insensitive click targets", () => {
    setupShortTimeout();

    it.each(INSENSITIVE_BUTTON_ACTIONS)(
        "rejects %s on an insensitive button without emitting clicked",
        (_label, action) => expectInsensitiveButtonRejection(action),
    );

    it("rejects click on an insensitive switch without toggling it", async () => {
        await render(<GtkSwitch sensitive={false} />);
        const switchWidget = await screen.findByRole(Gtk.AccessibleRole.SWITCH);
        await expect(userEvent.click(switchWidget)).rejects.toThrow(NOT_SENSITIVE_PATTERN);
        expect((switchWidget as Gtk.Switch).getActive()).toBe(false);
    });

    it("rejects click on an insensitive checkbox without activating it", async () => {
        await render(<GtkCheckButton label="Option" sensitive={false} />);
        const checkbox = await screen.findByRole(Gtk.AccessibleRole.CHECKBOX);
        await expect(userEvent.click(checkbox)).rejects.toThrow(NOT_SENSITIVE_PATTERN);
        expect((checkbox as Gtk.CheckButton).getActive()).toBe(false);
    });

    it("rejects click on a sensitive button inside an insensitive ancestor", async () => {
        const handleClick = vi.fn();

        await render(
            <GtkBox sensitive={false}>
                <GtkButton label="Nested" onClicked={handleClick} />
            </GtkBox>,
        );

        const button = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Nested" });
        await expect(userEvent.click(button)).rejects.toThrow(NOT_SENSITIVE_PATTERN);
        expect(handleClick).not.toHaveBeenCalled();
    });
});

describe("userEvent actionability - insensitive text targets", () => {
    setupShortTimeout();

    it("rejects type on an insensitive entry without changing its text", async () => {
        await render(<GtkEntry sensitive={false} text="before" />);
        const entry = await screen.findByRole(Gtk.AccessibleRole.TEXT_BOX);
        await expect(userEvent.type(entry, "typed")).rejects.toThrow(NOT_SENSITIVE_PATTERN);
        expect((entry as Gtk.Entry).getText()).toBe("before");
    });

    it("rejects clear on an insensitive entry without changing its text", async () => {
        await render(<GtkEntry sensitive={false} text="kept" />);
        const entry = await screen.findByRole(Gtk.AccessibleRole.TEXT_BOX);
        await expect(userEvent.clear(entry)).rejects.toThrow(NOT_SENSITIVE_PATTERN);
        expect((entry as Gtk.Entry).getText()).toBe("kept");
    });

    it("rejects paste on an insensitive entry without changing its text", async () => {
        await render(<GtkEntry sensitive={false} />);
        const entry = await screen.findByRole(Gtk.AccessibleRole.TEXT_BOX);
        await expect(userEvent.paste(entry, "pasted")).rejects.toThrow(NOT_SENSITIVE_PATTERN);
        expect((entry as Gtk.Entry).getText()).toBe("");
    });
});

describe("userEvent actionability - insensitive adjustment targets", () => {
    setupShortTimeout();

    it("rejects slide on an insensitive scale without changing its value", async () => {
        await render(<GtkScale sensitive={false} />);
        const scale = await screen.findByRole(Gtk.AccessibleRole.SLIDER, { as: Gtk.Scale });
        const before = scale.getValue();
        await expect(userEvent.slide(scale, 45)).rejects.toThrow(NOT_SENSITIVE_PATTERN);
        expect(scale.getValue()).toBe(before);
    });

    it("rejects scroll on an insensitive scrolled window without moving its adjustments", async () => {
        const ref = createRef<Gtk.ScrolledWindow>();

        await render(
            <GtkScrolledWindow ref={ref} sensitive={false} minContentHeight={200}>
                <GtkBox orientation={Gtk.Orientation.VERTICAL} heightRequest={2000}>
                    <GtkLabel>content</GtkLabel>
                </GtkBox>
            </GtkScrolledWindow>,
        );

        const scrolledWindow = ref.current as Gtk.ScrolledWindow;
        await expect(userEvent.scroll(scrolledWindow, { y: 100 })).rejects.toThrow(NOT_SENSITIVE_PATTERN);
        expect(scrolledWindow.getVadjustment().getValue()).toBe(0);
    });
});

describe("userEvent actionability - insensitive selection targets", () => {
    setupShortTimeout();

    it("rejects selectOptions on a dropdown inside an insensitive ancestor", async () => {
        await render(
            <GtkBox sensitive={false}>
                <GtkDropDown model={Gtk.StringList.new(["Option A", "Option B"])} />
            </GtkBox>,
        );

        const dropdown = await screen.findByRole(Gtk.AccessibleRole.COMBO_BOX);
        const before = (dropdown as Gtk.DropDown).getSelected();
        await expect(userEvent.selectOptions(dropdown, 1)).rejects.toThrow(NOT_SENSITIVE_PATTERN);
        expect((dropdown as Gtk.DropDown).getSelected()).toBe(before);
    });

    it("rejects deselectOptions on an insensitive list box", async () => {
        await render(
            <GtkListBox sensitive={false} selectionMode={Gtk.SelectionMode.MULTIPLE}>
                <GtkListBoxRow>
                    <GtkLabel>Item 1</GtkLabel>
                </GtkListBoxRow>
            </GtkListBox>,
        );

        const listBox = await screen.findByRole(Gtk.AccessibleRole.LIST);
        await expect(userEvent.deselectOptions(listBox, 0)).rejects.toThrow(NOT_SENSITIVE_PATTERN);
    });
});

describe("userEvent actionability - insensitive keyboard targets", () => {
    setupShortTimeout();

    it("rejects keyboard input on an insensitive shortcut host without activating shortcuts", async () => {
        const trigger = Gtk.ShortcutTrigger.parseString("F5");
        const { host, onActivate } = await renderShortcutHost({ trigger, isSensitive: false });
        await expect(userEvent.keyboard(host, "{F5}")).rejects.toThrow(NOT_SENSITIVE_PATTERN);
        expect(onActivate).not.toHaveBeenCalled();
    });

    it("rejects tab on an insensitive button", () =>
        expectInsensitiveButtonRejection((button) => userEvent.tab(button)));
});

describe("userEvent actionability - insensitive gesture targets", () => {
    setupShortTimeout();

    it("rejects hover on an insensitive widget without emitting enter", async () => {
        const handleEnter = vi.fn();
        const gesture = <GtkEventControllerMotion onEnter={handleEnter} />;
        const label = await renderInsensitiveGesturedLabel("hovered", "Hover me", gesture);
        await expect(userEvent.hover(label)).rejects.toThrow(NOT_SENSITIVE_PATTERN);
        expect(handleEnter).not.toHaveBeenCalled();
    });

    it("rejects longPress on an insensitive widget without emitting pressed", async () => {
        const handlePressed = vi.fn();
        const gesture = <GtkGestureLongPress onPressed={handlePressed} />;
        const label = await renderInsensitiveGesturedLabel("long-pressed", "Long press me", gesture);
        await expect(userEvent.longPress(label)).rejects.toThrow(NOT_SENSITIVE_PATTERN);
        expect(handlePressed).not.toHaveBeenCalled();
    });

    it("rejects drag on an insensitive widget without emitting drag signals", async () => {
        const handleDragBegin = vi.fn();
        const gesture = <GtkGestureDrag onDragBegin={handleDragBegin} />;
        const label = await renderInsensitiveGesturedLabel("dragged", "Drag me", gesture);
        await expect(userEvent.drag(label, 10, 10)).rejects.toThrow(NOT_SENSITIVE_PATTERN);
        expect(handleDragBegin).not.toHaveBeenCalled();
    });

    it("rejects drop on an insensitive target without invoking onDrop", async () => {
        const handleDrop = vi.fn().mockReturnValue(true);

        const gesture = (
            <GtkDropTarget types={[GObject.TYPE_STRING]} actions={Gdk.DragAction.COPY} onDrop={handleDrop} />
        );

        const target = await renderInsensitiveGesturedLabel("drop-zone", "Drop here", gesture);
        await expect(userEvent.drop(target, "payload")).rejects.toThrow(NOT_SENSITIVE_PATTERN);
        expect(handleDrop).not.toHaveBeenCalled();
    });

    it("rejects dragAndDrop from an insensitive source without invoking onDrop", async () => {
        const handleDrop = vi.fn().mockReturnValue(true);
        const { source, target } = await renderDragAndDropPair({ onDrop: handleDrop, isSourceSensitive: false });
        await expect(userEvent.dragAndDrop(source, target, "payload")).rejects.toThrow(NOT_SENSITIVE_PATTERN);
        expect(handleDrop).not.toHaveBeenCalled();
    });
});

describe("userEvent actionability - timeout error", () => {
    afterEach(() => {
        configure(initialConfig);
    });

    it("names the widget and the failing condition for an insensitive target", async () => {
        configure({ actionabilityTimeout: 60 });
        await render(<GtkButton name="save-button" label="Save" sensitive={false} />);
        const button = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Save" });

        await expect(userEvent.click(button)).rejects.toThrow(
            'Cannot dispatch user event: <Button accessible-name="Save" name="save-button" role="button"> ' +
            "did not become actionable " +
            "within 60ms because it is not sensitive (the widget or one of its ancestors is disabled)",
        );
    });

    it("reports an unmapped widget on a non-visible stack page", async () => {
        const handleClick = vi.fn();
        const concealedRef = createRef<Gtk.Button>();

        await render(
            <GtkStack>
                <GtkStackPage name="shown-page">
                    <GtkButton label="Shown" />
                </GtkStackPage>
                <GtkStackPage name="hidden-page">
                    <GtkButton ref={concealedRef} label="Concealed" onClicked={handleClick} />
                </GtkStackPage>
            </GtkStack>,
        );

        const shown = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Shown" });
        await userEvent.click(shown);
        configure({ actionabilityTimeout: 60 });
        expect(screen.queryByRole(Gtk.AccessibleRole.BUTTON, { name: "Concealed", hidden: true })).toBeNull();
        const concealed = concealedRef.current as Gtk.Button;

        await expect(userEvent.click(concealed)).rejects.toThrow(
            '<Button accessible-name="Concealed" role="button"> did not become actionable ' +
            "within 60ms because it is not mapped",
        );

        expect(handleClick).not.toHaveBeenCalled();
    });
});

describe("userEvent actionability - targets outside a toplevel", () => {
    setupShortTimeout();

    it("rejects click on a widget whose conditional render was removed", async () => {
        const { handleClick, removable } = await renderRemovableButton();
        expect(removable.getRoot()).toBeNull();
        await expect(userEvent.click(removable)).rejects.toThrow(NOT_ROOTED_PATTERN);
        expect(handleClick).not.toHaveBeenCalled();
    });

    it("rejects type on an entry rendered into a container outside any window", async () => {
        const box = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL });
        const entryRef = createRef<Gtk.Entry>();
        await render(<GtkEntry ref={entryRef} text="before" />, { container: box });
        const entry = entryRef.current as Gtk.Entry;
        expect(entry.getRoot()).toBeNull();
        await expect(userEvent.type(entry, "typed")).rejects.toThrow(NOT_ROOTED_PATTERN);
        expect(entry.getText()).toBe("before");
    });

    it("rejects click on a widget whose render was unmounted", async () => {
        const handleClick = vi.fn();
        const buttonRef = createRef<Gtk.Button>();
        const { unmount } = await render(<GtkButton ref={buttonRef} label="Gone" onClicked={handleClick} />);
        const button = buttonRef.current as Gtk.Button;
        await unmount();
        expect(button.getRoot()).toBeNull();
        await expect(userEvent.click(button)).rejects.toThrow(NOT_ROOTED_PATTERN);
        expect(handleClick).not.toHaveBeenCalled();
    });
});

describe("userEvent actionability - hidden windows", () => {
    setupShortTimeout();

    it("rejects click on a button whose window was hidden after it was shown", async () => {
        const { handleMainClick, mainButton } = await renderHiddenMainWindow();
        await expect(userEvent.click(mainButton)).rejects.toThrow(WINDOW_HIDDEN_PATTERN);
        expect(handleMainClick).not.toHaveBeenCalled();
    });

    it("clicks the same button once its window is shown again", async () => {
        const { handleMainClick, main, mainButton } = await renderHiddenMainWindow();

        await act(() => {
            main.present();
        });

        await userEvent.click(mainButton);
        expect(handleMainClick).toHaveBeenCalledTimes(1);
    });
});

describe("userEvent actionability - toplevels that are not windows", () => {
    setupShortTimeout();

    it("clicks a button inside a drag icon, whose root is no window", async () => {
        const { button, handleClick } = await renderDragIconButton(true);

        await waitFor(() => {
            expect(button.getMapped()).toBe(true);
        });

        await userEvent.click(button);
        expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it("rejects click on an unmapped button inside a drag icon", async () => {
        const { button, handleClick } = await renderDragIconButton(false);

        await expect(userEvent.click(button)).rejects.toThrow(
            '<Button accessible-name="Dragged" role="button"> did not become actionable ' +
            "within 60ms because it is not mapped",
        );

        expect(handleClick).not.toHaveBeenCalled();
    });
});

describe("userEvent actionability - background toplevels", () => {
    it("clicks a button in a window another toplevel has taken the activation from", async () => {
        const { handleMainClick, mainButton } = await renderBackgroundedMainWindow();
        await userEvent.click(mainButton);
        expect(handleMainClick).toHaveBeenCalledTimes(1);
    });

    it("types into an entry in a window another toplevel has taken the activation from", async () => {
        await renderBackgroundedMainWindow();
        const entry = await screen.findByRole(Gtk.AccessibleRole.TEXT_BOX, { as: Gtk.Entry });
        await userEvent.type(entry, "typed");
        expect(entry.getText()).toBe("beforetyped");
    });

    it("clicks a button in a window a client outside this process has taken the activation from", async () => {
        const { handleMainClick, main, mainButton } = await renderSoleMainWindow();

        await withActivationHeldOutsideThisProcess(main, async () => {
            await userEvent.click(mainButton);
        });

        expect(handleMainClick).toHaveBeenCalledTimes(1);
    });

    it("types into an entry in a window a client outside this process has taken the activation from", async () => {
        const { main } = await renderSoleMainWindow();
        const entry = await screen.findByRole(Gtk.AccessibleRole.TEXT_BOX, { as: Gtk.Entry });

        await withActivationHeldOutsideThisProcess(main, async () => {
            await userEvent.type(entry, "typed");
        });

        expect(entry.getText()).toBe("beforetyped");
    });
});

describe("userEvent actionability - modal toplevels", () => {
    setupShortTimeout();

    it("rejects click on a window a modal toplevel holds the grab over", async () => {
        const { handleMainClick, mainButton } = await renderModalDialog(<GtkLabel>Blocking</GtkLabel>);
        await expect(userEvent.click(mainButton)).rejects.toThrow(MODAL_PATTERN);
        expect(handleMainClick).not.toHaveBeenCalled();
    });

    it("clicks a button inside the modal toplevel itself", async () => {
        const handleConfirm = vi.fn();
        await renderModalDialog(<GtkButton label="Confirm" onClicked={handleConfirm} />);
        const confirm = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Confirm" });
        await userEvent.click(confirm);
        expect(handleConfirm).toHaveBeenCalledTimes(1);
    });

    it("clicks a button in a window a modal toplevel of another window group cannot grab", async () => {
        const { dialog, handleMainClick, mainButton } = await renderModalDialog(<GtkLabel>Blocking</GtkLabel>);

        await act(() => {
            Gtk.WindowGroup.new().addWindow(dialog);
        });

        await userEvent.click(mainButton);
        expect(handleMainClick).toHaveBeenCalledTimes(1);
    });

    it("clicks a button inside a modal toplevel stacked on another modal toplevel", async () => {
        const handleConfirm = vi.fn();

        const { dialog } = await renderModalDialog(
            <GtkBox orientation={Gtk.Orientation.VERTICAL}>
                <GtkLabel>Blocking</GtkLabel>
                <GtkWindow title="Nested" modal defaultWidth={120} defaultHeight={80}>
                    <GtkButton label="Confirm" onClicked={handleConfirm} />
                </GtkWindow>
            </GtkBox>,
        );

        const nested = await findMappedWindow("Nested");
        expect(nested.getTransientFor()).toBe(dialog);
        const confirm = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Confirm" });
        await userEvent.click(confirm);
        expect(handleConfirm).toHaveBeenCalledTimes(1);
    });
});

describe("userEvent actionability - ready widgets", () => {
    it("dispatches promptly on a mapped, sensitive widget", async () => {
        const handleClick = vi.fn();
        await render(<GtkButton label="Ready" onClicked={handleClick} />);
        const button = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Ready" });
        await userEvent.click(button);
        const start = performance.now();
        await userEvent.click(button);
        const elapsed = performance.now() - start;
        expect(handleClick).toHaveBeenCalledTimes(2);
        expect(elapsed).toBeLessThan(250);
    });
});
