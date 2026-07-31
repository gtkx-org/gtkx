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
    GtkShortcut,
    GtkShortcutController,
    GtkStack,
    GtkStackPage,
    GtkSwitch,
} from "@gtkx/jsx/gtk";
import { createRef, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { configure, getConfig, render, screen, userEvent } from "../src/index.js";
import { renderDragAndDropPair } from "./event-render-setup.js";

const initialConfig = { ...getConfig() };
const NOT_SENSITIVE_PATTERN = /did not become actionable within 60ms because it is not sensitive/;

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

const renderInsensitiveGesturedLabel = async (
    name: string,
    label: string,
    gesture: ReactNode,
): Promise<Gtk.Widget> => {
    await render(
        <GtkLabel name={name} sensitive={false} controllers={gesture}>
            {label}
        </GtkLabel>,
    );

    return screen.findByName(name);
};

describe("userEvent actionability - insensitive click targets", () => {
    setupShortTimeout();

    it.each(INSENSITIVE_BUTTON_ACTIONS)(
        "rejects %s on an insensitive button without emitting clicked",
        async (_label, action) => {
            const { button, handleClick } = await renderInsensitiveButton();
            await expect(action(button)).rejects.toThrow(NOT_SENSITIVE_PATTERN);
            expect(handleClick).not.toHaveBeenCalled();
        },
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
        const onActivate = vi.fn(() => true);

        await render(
            <GtkBox
                name="host"
                sensitive={false}
                controllers={(
                    <GtkShortcutController
                        scope={Gtk.ShortcutScope.GLOBAL}
                        shortcuts={(
                            <GtkShortcut
                                trigger={Gtk.ShortcutTrigger.parseString("F5")}
                                action={Gtk.CallbackAction.new(onActivate)}
                            />
                        )}
                    />
                )}
            >
                <GtkLabel>anchor</GtkLabel>
            </GtkBox>,
        );

        const host = await screen.findByName("host");
        await expect(userEvent.keyboard(host, "{F5}")).rejects.toThrow(NOT_SENSITIVE_PATTERN);
        expect(onActivate).not.toHaveBeenCalled();
    });

    it("rejects tab on an insensitive button", async () => {
        const { button, handleClick } = await renderInsensitiveButton();
        await expect(userEvent.tab(button)).rejects.toThrow(NOT_SENSITIVE_PATTERN);
        expect(handleClick).not.toHaveBeenCalled();
    });
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
        const { source, target } = await renderDragAndDropPair({ onDrop: handleDrop, sourceSensitive: false });
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
            'Cannot dispatch user event: <Button name="save-button" role="button"> did not become actionable ' +
            "within 60ms because it is not sensitive (the widget or one of its ancestors is disabled)",
        );
    });

    it("reports an unmapped widget on a non-visible stack page", async () => {
        const handleClick = vi.fn();

        await render(
            <GtkStack>
                <GtkStackPage name="shown-page">
                    <GtkButton label="Shown" />
                </GtkStackPage>
                <GtkStackPage name="hidden-page">
                    <GtkButton label="Concealed" onClicked={handleClick} />
                </GtkStackPage>
            </GtkStack>,
        );

        const shown = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Shown" });
        await userEvent.click(shown);
        configure({ actionabilityTimeout: 60 });
        const concealed = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Concealed" });

        await expect(userEvent.click(concealed)).rejects.toThrow(
            /<Button role="button"> did not become actionable within 60ms because it is not mapped/,
        );

        expect(handleClick).not.toHaveBeenCalled();
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
