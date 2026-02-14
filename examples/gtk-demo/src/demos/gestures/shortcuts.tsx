import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkButton, GtkLabel } from "@gtkx/react";
import { useCallback } from "react";
import type { Demo, DemoProps } from "../types.js";
import sourceCode from "./shortcuts.tsx?raw";

function shortcut(title: string, accelerator: string): Gtk.ShortcutsShortcut {
    const s = new Gtk.ShortcutsShortcut();
    s.setTitle(title);
    s.setAccelerator(accelerator);
    return s;
}

function gesture(title: string, type: Gtk.ShortcutType): Gtk.ShortcutsShortcut {
    const s = new Gtk.ShortcutsShortcut();
    s.setTitle(title);
    s.setShortcutType(type);
    return s;
}

function dirShortcut(title: string, accelerator: string, direction: Gtk.TextDirection): Gtk.ShortcutsShortcut {
    const s = new Gtk.ShortcutsShortcut();
    s.setTitle(title);
    s.setAccelerator(accelerator);
    s.setDirection(direction);
    return s;
}

function group(title: string, shortcuts: Gtk.ShortcutsShortcut[], view?: string): Gtk.ShortcutsGroup {
    const g = new Gtk.ShortcutsGroup();
    g.setTitle(title);
    if (view) {
        g.setView(view);
    }
    for (const s of shortcuts) {
        g.addShortcut(s);
    }
    return g;
}

function createGeditWindow(): Gtk.ShortcutsWindow {
    const win = new Gtk.ShortcutsWindow();

    const section = new Gtk.ShortcutsSection();
    section.setSectionName("shortcuts");
    section.setMaxHeight(12);

    section.addGroup(
        group("Touchpad gestures", [
            gesture("Switch to the next document", Gtk.ShortcutType.GESTURE_TWO_FINGER_SWIPE_RIGHT),
            gesture("Switch to the previous document", Gtk.ShortcutType.GESTURE_TWO_FINGER_SWIPE_LEFT),
        ]),
    );

    section.addGroup(
        group("Documents", [
            shortcut("Create new document", "<Control>n"),
            shortcut("Open a document", "<Control>o"),
            shortcut("Save the document", "<Control>s"),
            shortcut("Close the document", "<Control>w"),
            shortcut("Switch to the next document", "<Control><Alt>Page_Down"),
            shortcut("Switch to the previous document", "<Control><Alt>Page_Up"),
        ]),
    );

    section.addGroup(
        group("Find and Replace", [
            shortcut("Find", "<Control>f"),
            shortcut("Find the next match", "<Control>g"),
            shortcut("Find the previous match", "<Control><Shift>g"),
            shortcut("Find and Replace", "<Control>h"),
            shortcut("Clear highlight", "<Control><Shift>k"),
            shortcut("Go to line", "<Control>i"),
        ]),
    );

    section.addGroup(group("Tools", [shortcut("Check spelling", "<Shift>F7")]));

    section.addGroup(
        group("Miscellaneous", [
            shortcut("Fullscreen on / off", "F11"),
            shortcut("Print the document", "<Control>p"),
            shortcut("Toggle insert / overwrite", "Insert"),
        ]),
    );

    win.addSection(section);
    return win;
}

function createClocksWindow(): Gtk.ShortcutsWindow {
    const win = new Gtk.ShortcutsWindow();

    const section = new Gtk.ShortcutsSection();
    section.setSectionName("shortcuts");
    section.setMaxHeight(10);

    section.addGroup(
        group("General", [
            shortcut("Go to the next section", "<Control>Page_Down"),
            shortcut("Go to the previous section", "<Control>Page_Up"),
            shortcut("Quit", "<Alt>q"),
            dirShortcut("Forward", "<Alt>Right", Gtk.TextDirection.LTR),
            dirShortcut("Back", "<Control>Left", Gtk.TextDirection.LTR),
            dirShortcut("Forward", "<Alt>Left", Gtk.TextDirection.RTL),
            dirShortcut("Back", "<Control>Right", Gtk.TextDirection.RTL),
        ]),
    );

    section.addGroup(
        group(
            "World Clocks",
            [shortcut("Add a world clock", "<Control>n"), shortcut("Select world clocks", "<Control>s")],
            "world",
        ),
    );

    section.addGroup(
        group("Alarm", [shortcut("Add an alarm", "<Control>n"), shortcut("Select alarms", "<Control>s")], "alarm"),
    );

    section.addGroup(
        group(
            "Stopwatch",
            [shortcut("Start / Stop / Continue", "Return space"), shortcut("Lap", "l"), shortcut("Reset", "Delete")],
            "stopwatch",
        ),
    );

    section.addGroup(
        group("Timer", [shortcut("Start / Stop / Pause", "Return space"), shortcut("Reset", "Delete")], "timer"),
    );

    win.addSection(section);
    return win;
}

function createBoxesWindow(): Gtk.ShortcutsWindow {
    const win = new Gtk.ShortcutsWindow();

    const section = new Gtk.ShortcutsSection();
    section.setSectionName("shortcuts");
    section.setMaxHeight(12);

    section.addGroup(
        group(
            "Overview",
            [
                shortcut("Help", "F1"),
                shortcut("Create a new box", "<Control>n"),
                shortcut("Search", "<Control>f"),
                shortcut("Keyboard shortcuts", "<Control>k"),
                shortcut("Close Window/Quit Boxes", "<Control>q"),
            ],
            "overview",
        ),
    );

    section.addGroup(
        group(
            "Box Creation and Properties",
            [
                dirShortcut("Switch to the next page", "<Alt>Right", Gtk.TextDirection.LTR),
                dirShortcut("Switch to the previous page", "<Alt>Left", Gtk.TextDirection.LTR),
                dirShortcut("Switch to the next page", "<Alt>Left", Gtk.TextDirection.RTL),
                dirShortcut("Switch to the previous page", "<Alt>Right", Gtk.TextDirection.RTL),
            ],
            "wizard",
        ),
    );

    section.addGroup(
        group(
            "Box Display",
            [
                shortcut("Grab/Ungrab keyboard", "Control_L&Alt_L"),
                dirShortcut("Back to overview", "<Alt>Left", Gtk.TextDirection.LTR),
                dirShortcut("Back to overview", "<Alt>Right", Gtk.TextDirection.RTL),
                shortcut("Close window/Quit Boxes", "<Control>q"),
                shortcut("Fullscreen/Restore from fullscreen", "F11"),
            ],
            "display",
        ),
    );

    win.addSection(section);
    return win;
}

function createBuilderWindow(): Gtk.ShortcutsWindow {
    const win = new Gtk.ShortcutsWindow();

    const editorSection = new Gtk.ShortcutsSection();
    editorSection.setSectionName("editor");
    editorSection.setTitle("Editor Shortcuts");

    editorSection.addGroup(
        group("General", [
            shortcut("Global Search", "<Control>period"),
            shortcut("Preferences", "<Control>comma"),
            shortcut("Command Bar", "<Control>Return"),
            shortcut("Terminal", "<Control><Shift>t"),
            shortcut("Keyboard Shortcuts", "<Control><Shift>question"),
        ]),
    );

    editorSection.addGroup(
        group("Panels", [
            shortcut("Toggle left panel", "F9"),
            shortcut("Toggle right panel", "<Shift>F9"),
            shortcut("Toggle bottom panel", "<Control>F9"),
        ]),
    );

    editorSection.addGroup(
        group("Touchpad gestures", [
            gesture("Switch to the next document", Gtk.ShortcutType.GESTURE_TWO_FINGER_SWIPE_RIGHT),
            gesture("Switch to the previous document", Gtk.ShortcutType.GESTURE_TWO_FINGER_SWIPE_LEFT),
        ]),
    );

    editorSection.addGroup(
        group("Files", [
            shortcut("Create new document", "<Control>n"),
            shortcut("Open a document", "<Control>o"),
            shortcut("Save the document", "<Control>s"),
            shortcut("Close the document", "<Control>w"),
            shortcut("Switch to the next document", "<Control><Alt>Page_Down"),
            shortcut("Switch to the previous document", "<Control><Alt>Page_Up"),
        ]),
    );

    editorSection.addGroup(
        group("Find and replace", [
            shortcut("Find", "<Control>f"),
            shortcut("Find the next match", "<Control>g"),
            shortcut("Find the previous match", "<Control><Shift>g"),
            shortcut("Find and Replace", "<Control>h"),
            shortcut("Clear highlight", "<Control><Shift>k"),
        ]),
    );

    editorSection.addGroup(
        group("Copy and Paste", [
            shortcut("Copy selected text to clipboard", "<Control>c"),
            shortcut("Cut selected text to clipboard", "<Control>x"),
            shortcut("Paste text from clipboard", "<Control>v"),
        ]),
    );

    editorSection.addGroup(
        group("Undo and Redo", [
            shortcut("Undo previous command", "<Control>z"),
            shortcut("Redo previous command", "<Control><Shift>z"),
        ]),
    );

    editorSection.addGroup(
        group("Editing", [
            shortcut("Increment number at cursor", "<Control><Shift>a"),
            shortcut("Decrement number at cursor", "<Control><Shift>x"),
            shortcut("Join selected lines", "<Control>j"),
            shortcut("Show completion window", "<Control>space"),
            shortcut("Toggle overwrite", "Insert"),
            shortcut("Reindent line", "<Control><Alt>i"),
        ]),
    );

    editorSection.addGroup(
        group("Navigation", [
            shortcut("Move to next error in file", "<Alt>n"),
            shortcut("Move to previous error in file", "<Alt>p"),
            shortcut("Move to previous edit location", "<Shift><Alt>Left"),
            shortcut("Move to next edit location", "<Shift><Alt>Right"),
            shortcut("Jump to definition of symbol", "<Alt>period"),
            shortcut("Move sectionport up within the file", "<Alt><Shift>Up"),
            shortcut("Move sectionport down within the file", "<Alt><Shift>Down"),
            shortcut("Move sectionport to end of file", "<Alt><Shift>End"),
            shortcut("Move sectionport to beginning of file", "<Alt><Shift>Home"),
            shortcut("Move to matching bracket", "<Control>percent"),
        ]),
    );

    editorSection.addGroup(
        group("Selections", [shortcut("Select all", "<Control>a"), shortcut("Unselect all", "<Control>backslash")]),
    );

    win.addSection(editorSection);

    const terminalSection = new Gtk.ShortcutsSection();
    terminalSection.setSectionName("terminal");
    terminalSection.setTitle("Terminal Shortcuts");
    terminalSection.setMaxHeight(16);

    terminalSection.addGroup(
        group("General", [
            shortcut("Global Search", "<Control>period"),
            shortcut("Preferences", "<Control>comma"),
            shortcut("Command Bar", "<Control>Return"),
            shortcut("Terminal", "<Control><Shift>t"),
            shortcut("Keyboard Shortcuts", "<Control><Shift>question"),
        ]),
    );

    terminalSection.addGroup(
        group("Copy and Paste", [
            shortcut("Copy selected text to clipboard", "<Control><Shift>c"),
            shortcut("Paste text from clipboard", "<Control><Shift>v"),
        ]),
    );

    terminalSection.addGroup(group("Switching", [shortcut("Switch to n-th tab", "<Alt>1...9")]));

    terminalSection.addGroup(
        group("'Special' combinations", [
            shortcut("You want tea ?", "t+t"),
            shortcut("Shift Control", "<Shift><Control>"),
            shortcut("Control Control", "<Control>&<Control>"),
            shortcut("Left and right control", "Control_L&Control_R"),
        ]),
    );

    terminalSection.addGroup(
        group("All gestures", [
            gesture("A stock pinch gesture", Gtk.ShortcutType.GESTURE_PINCH),
            gesture("A stock stretch gesture", Gtk.ShortcutType.GESTURE_STRETCH),
            gesture("A stock rotation gesture", Gtk.ShortcutType.GESTURE_ROTATE_CLOCKWISE),
            gesture("A stock rotation gesture", Gtk.ShortcutType.GESTURE_ROTATE_COUNTERCLOCKWISE),
            gesture("A stock swipe gesture", Gtk.ShortcutType.GESTURE_TWO_FINGER_SWIPE_LEFT),
            gesture("A stock swipe gesture", Gtk.ShortcutType.GESTURE_TWO_FINGER_SWIPE_RIGHT),
            gesture("A stock swipe gesture", Gtk.ShortcutType.GESTURE_SWIPE_LEFT),
            gesture("A stock swipe gesture", Gtk.ShortcutType.GESTURE_SWIPE_RIGHT),
        ]),
    );

    win.addSection(terminalSection);
    return win;
}

function showShortcutsWindow(parent: Gtk.Window, builder: () => Gtk.ShortcutsWindow, viewName?: string) {
    const win = builder();
    win.setTransientFor(parent);
    if (viewName) {
        win.setViewName(viewName);
    }
    win.present();
}

const ShortcutsDemo = ({ window }: DemoProps) => {
    const show = useCallback(
        (builder: () => Gtk.ShortcutsWindow, viewName?: string) => {
            const parent = window.current;
            if (parent) {
                showShortcutsWindow(parent, builder, viewName);
            }
        },
        [window],
    );

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
            <GtkLabel label="Shortcuts Window" cssClasses={["title-2"]} halign={Gtk.Align.START} />
            <GtkLabel
                label="GtkShortcutsWindow shows the keyboard shortcuts and gestures of an application. Shortcuts can be grouped, filtered by view, and support gestures and direction variants."
                wrap
                halign={Gtk.Align.START}
                cssClasses={["dim-label"]}
            />

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={6}>
                <GtkLabel label="Gedit" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkButton label="Gedit Shortcuts" halign={Gtk.Align.START} onClicked={() => show(createGeditWindow)} />
            </GtkBox>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={6}>
                <GtkLabel label="Clocks" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkBox spacing={6}>
                    <GtkButton label="All Views" onClicked={() => show(createClocksWindow)} />
                    <GtkButton label="Stopwatch View" onClicked={() => show(createClocksWindow, "stopwatch")} />
                </GtkBox>
            </GtkBox>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={6}>
                <GtkLabel label="Boxes" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkBox spacing={6}>
                    <GtkButton label="All Views" onClicked={() => show(createBoxesWindow)} />
                    <GtkButton label="Wizard View" onClicked={() => show(createBoxesWindow, "wizard")} />
                    <GtkButton label="Display View" onClicked={() => show(createBoxesWindow, "display")} />
                </GtkBox>
            </GtkBox>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={6}>
                <GtkLabel label="Builder" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkButton
                    label="Builder Shortcuts"
                    halign={Gtk.Align.START}
                    onClicked={() => show(createBuilderWindow)}
                />
            </GtkBox>
        </GtkBox>
    );
};

export const shortcutsDemo: Demo = {
    id: "shortcuts",
    title: "Shortcuts Window",
    description: "GtkShortcutsWindow shows keyboard shortcuts and gestures in a structured, searchable window",
    keywords: [
        "keyboard",
        "shortcut",
        "accelerator",
        "gesture",
        "hotkey",
        "keybinding",
        "GtkShortcutsWindow",
        "GtkShortcutsSection",
        "GtkShortcutsGroup",
        "GtkShortcutsShortcut",
        "key",
        "binding",
    ],
    component: ShortcutsDemo,
    sourceCode,
};
