import { DropDown, SizeGroup } from "@gtkx/components";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkCheckButton, GtkFrame, GtkLabel } from "@gtkx/jsx/gtk";
import { useState } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./sizegroup.tsx?raw";

type DropdownRowProps = {
    labelText: string;
    selectedId: string;
    options: string[];
    onSelectionChanged: (id: string) => void;
};

type ColorFrameProps = {
    foreground: string;
    background: string;
    onForeground: (id: string) => void;
    onBackground: (id: string) => void;
};

type LineFrameProps = {
    dashing: string;
    lineEnd: string;
    onDashing: (id: string) => void;
    onLineEnd: (id: string) => void;
};

const COLOR_OPTIONS = ["Red", "Green", "Blue"];
const DASH_OPTIONS = ["Solid", "Dashed", "Dotted"];
const END_OPTIONS = ["Square", "Round", "Double Arrow"];

const sizegroupDemo: Demo = {
    id: "sizegroup",
    title: "Size Groups",
    description:
        "GtkSizeGroup provides a mechanism for grouping a number of widgets together so they all " +
        "request the same amount of space. This is typically useful when you want a column of " +
        "widgets to have the same size, but you can't use a GtkTable widget.\n\nNote that size " +
        "groups only affect the amount of space requested, not the size that the widgets finally " +
        "receive. If you want the widgets in a GtkSizeGroup to actually be the same size, you need " +
        "to pack them in such a way that they get the size they request and not more. For example, " +
        "if you are packing your widgets into a table, you would not include the GTK_FILL flag.",
    keywords: [],
    component: SizeGroupDemo,
    sourceCode,
    resizable: false,
};

const DropdownRow = ({ labelText, selectedId, options, onSelectionChanged }: DropdownRowProps) => {
    const [dropdown, setDropdown] = useState<Gtk.DropDown | null>(null);

    return (
        <GtkBox orientation={Gtk.Orientation.HORIZONTAL} spacing={10}>
            <GtkLabel useUnderline halign={Gtk.Align.START} hexpand mnemonicWidget={dropdown}>
                {labelText}
            </GtkLabel>
            <SizeGroup.Child
                component={DropDown}
                ref={setDropdown}
                halign={Gtk.Align.END}
                valign={Gtk.Align.BASELINE_FILL}
                selectedId={selectedId}
                onSelectionChanged={onSelectionChanged}
                items={options.map((option) => ({ id: option, value: option }))}
            />
        </GtkBox>
    );
};

const renderColorFrame = ({ foreground, background, onForeground, onBackground }: ColorFrameProps) => (
    <GtkFrame name="color-options-frame" label="Color Options">
        <GtkBox
            orientation={Gtk.Orientation.VERTICAL}
            spacing={5}
            marginStart={5}
            marginEnd={5}
            marginTop={5}
            marginBottom={5}
        >
            <DropdownRow
                labelText="_Foreground"
                selectedId={foreground}
                options={COLOR_OPTIONS}
                onSelectionChanged={onForeground}
            />
            <DropdownRow
                labelText="_Background"
                selectedId={background}
                options={COLOR_OPTIONS}
                onSelectionChanged={onBackground}
            />
        </GtkBox>
    </GtkFrame>
);

const renderLineFrame = ({ dashing, lineEnd, onDashing, onLineEnd }: LineFrameProps) => (
    <GtkFrame name="line-options-frame" label="Line Options">
        <GtkBox
            orientation={Gtk.Orientation.VERTICAL}
            spacing={5}
            marginStart={5}
            marginEnd={5}
            marginTop={5}
            marginBottom={5}
        >
            <DropdownRow
                labelText="_Dashing"
                selectedId={dashing}
                options={DASH_OPTIONS}
                onSelectionChanged={onDashing}
            />
            <DropdownRow
                labelText="_Line ends"
                selectedId={lineEnd}
                options={END_OPTIONS}
                onSelectionChanged={onLineEnd}
            />
        </GtkBox>
    </GtkFrame>
);

function SizeGroupDemo() {
    const [groupingEnabled, setGroupingEnabled] = useState(true);
    const [foreground, setForeground] = useState("Red");
    const [background, setBackground] = useState("Red");
    const [dashing, setDashing] = useState("Solid");
    const [lineEnd, setLineEnd] = useState("Square");

    const handleToggle = (button: Gtk.CheckButton) => {
        setGroupingEnabled(button.getActive());
    };

    const mode = groupingEnabled ? Gtk.SizeGroupMode.HORIZONTAL : Gtk.SizeGroupMode.NONE;

    return (
        <GtkBox
            orientation={Gtk.Orientation.VERTICAL}
            spacing={5}
            marginStart={5}
            marginEnd={5}
            marginTop={5}
            marginBottom={5}
        >
            <SizeGroup mode={mode}>
                {renderColorFrame({
                    foreground,
                    background,
                    onForeground: setForeground,
                    onBackground: setBackground,
                })}
                {renderLineFrame({
                    dashing,
                    lineEnd,
                    onDashing: setDashing,
                    onLineEnd: setLineEnd,
                })}
            </SizeGroup>
            <GtkCheckButton
                name="enable-grouping-check"
                label="_Enable grouping"
                useUnderline
                active={groupingEnabled}
                onToggled={handleToggle}
            />
        </GtkBox>
    );
}

export { sizegroupDemo };
