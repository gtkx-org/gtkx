import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkButton, GtkEntry, GtkLabel } from "@gtkx/react";
import { useState } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./entry-undo.tsx?raw";

const EntryUndoDemo = () => {
    const [history, setHistory] = useState<string[]>([""]);
    const [historyIndex, setHistoryIndex] = useState(0);
    const [currentText, setCurrentText] = useState("");

    const handleTextChange = (newText: string) => {
        if (newText !== currentText) {
            const newHistory = history.slice(0, historyIndex + 1);
            newHistory.push(newText);
            setHistory(newHistory);
            setHistoryIndex(newHistory.length - 1);
            setCurrentText(newText);
        }
    };

    const handleUndo = () => {
        if (historyIndex > 0) {
            const newIndex = historyIndex - 1;
            setHistoryIndex(newIndex);
            setCurrentText(history[newIndex] ?? "");
        }
    };

    const handleRedo = () => {
        if (historyIndex < history.length - 1) {
            const newIndex = historyIndex + 1;
            setHistoryIndex(newIndex);
            setCurrentText(history[newIndex] ?? "");
        }
    };

    const canUndo = historyIndex > 0;
    const canRedo = historyIndex < history.length - 1;

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={20} marginStart={20} marginEnd={20} marginTop={20}>
            <GtkLabel label="Entry with Undo/Redo" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="Text Entry with History" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkLabel
                    label="Type in the entry below. Each change is recorded in history, and you can use the Undo/Redo buttons to navigate through your edits."
                    wrap
                    cssClasses={["dim-label"]}
                />

                <GtkEntry
                    text={currentText}
                    placeholderText="Type something and try undo/redo..."
                    onChanged={(entry) => handleTextChange(entry.getText())}
                />

                <GtkBox spacing={8}>
                    <GtkButton
                        label="Undo"
                        onClicked={handleUndo}
                        sensitive={canUndo}
                        cssClasses={canUndo ? [] : ["dim-label"]}
                    />
                    <GtkButton
                        label="Redo"
                        onClicked={handleRedo}
                        sensitive={canRedo}
                        cssClasses={canRedo ? [] : ["dim-label"]}
                    />
                </GtkBox>

                <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={4}>
                    <GtkLabel
                        label={`History position: ${historyIndex + 1} of ${history.length}`}
                        cssClasses={["dim-label"]}
                        halign={Gtk.Align.START}
                    />
                    <GtkLabel
                        label={`Current value: "${currentText}"`}
                        cssClasses={["dim-label"]}
                        halign={Gtk.Align.START}
                    />
                </GtkBox>
            </GtkBox>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="Native Undo Support" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkLabel
                    label="GtkEntry has built-in undo/redo support via the enableUndo property. When enabled, you can use Ctrl+Z to undo and Ctrl+Shift+Z (or Ctrl+Y) to redo changes directly in the entry."
                    wrap
                    cssClasses={["dim-label"]}
                />
                <GtkEntry placeholderText="Native undo enabled (Ctrl+Z / Ctrl+Shift+Z)..." enableUndo />
            </GtkBox>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="Keyboard Shortcuts" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkLabel
                    label={`Ctrl+Z: Undo
Ctrl+Shift+Z or Ctrl+Y: Redo`}
                    cssClasses={["dim-label", "monospace"]}
                    halign={Gtk.Align.START}
                />
            </GtkBox>
        </GtkBox>
    );
};

export const entryUndoDemo: Demo = {
    id: "entry-undo",
    title: "Entry Undo",
    description: "GtkEntry with undo/redo functionality.",
    keywords: ["entry", "undo", "redo", "history", "GtkEntry", "enableUndo"],
    component: EntryUndoDemo,
    sourceCode,
};
