import * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkCheckButton, GtkDropDown, GtkFrame, GtkLabel, GtkSizeGroup } from "@gtkx/react";
import { useCallback, useState } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./sizegroup.tsx?raw";

const COLOR_OPTIONS = ["Red", "Green", "Blue"];
const DASH_OPTIONS = ["Solid", "Dashed", "Dotted"];
const END_OPTIONS = ["Square", "Round", "Double Arrow"];

interface DropdownRowProps {
    labelText: string;
    selectedId: string;
    options: readonly string[];
    onSelectionChanged: (id: string) => void;
}

const DropdownRow = ({ labelText, selectedId, options, onSelectionChanged }: DropdownRowProps) => {
    const [dropdown, setDropdown] = useState<Gtk.DropDown | null>(null);
    return (
        <GtkBox orientation={Gtk.Orientation.HORIZONTAL} spacing={10}>
            <GtkLabel label={labelText} useUnderline halign={Gtk.Align.START} hexpand mnemonicWidget={dropdown} />
            <GtkSizeGroup.Widget>
                <GtkDropDown
                    ref={setDropdown}
                    halign={Gtk.Align.END}
                    valign={Gtk.Align.BASELINE_FILL}
                    selectedId={selectedId}
                    onSelectionChanged={onSelectionChanged}
                    items={options.map((option) => ({ id: option, value: option }))}
                />
            </GtkSizeGroup.Widget>
        </GtkBox>
    );
};

const SizeGroupDemo = () => {
    const [groupingEnabled, setGroupingEnabled] = useState(true);
    const [foreground, setForeground] = useState("Red");
    const [background, setBackground] = useState("Red");
    const [dashing, setDashing] = useState("Solid");
    const [lineEnd, setLineEnd] = useState("Square");

    const handleToggle = useCallback((button: Gtk.CheckButton) => setGroupingEnabled(button.getActive()), []);

    return (
        <GtkBox
            orientation={Gtk.Orientation.VERTICAL}
            spacing={5}
            marginStart={5}
            marginEnd={5}
            marginTop={5}
            marginBottom={5}
        >
            <GtkSizeGroup mode={groupingEnabled ? Gtk.SizeGroupMode.HORIZONTAL : Gtk.SizeGroupMode.NONE}>
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
                            onSelectionChanged={setForeground}
                        />
                        <DropdownRow
                            labelText="_Background"
                            selectedId={background}
                            options={COLOR_OPTIONS}
                            onSelectionChanged={setBackground}
                        />
                    </GtkBox>
                </GtkFrame>
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
                            onSelectionChanged={setDashing}
                        />
                        <DropdownRow
                            labelText="_Line ends"
                            selectedId={lineEnd}
                            options={END_OPTIONS}
                            onSelectionChanged={setLineEnd}
                        />
                    </GtkBox>
                </GtkFrame>
            </GtkSizeGroup>
            <GtkCheckButton
                name="enable-grouping-check"
                label="_Enable grouping"
                useUnderline
                active={groupingEnabled}
                onToggled={handleToggle}
            />
        </GtkBox>
    );
};

export const sizegroupDemo: Demo = {
    id: "sizegroup",
    title: "Size Groups",
    description:
        "GtkSizeGroup provides a mechanism for grouping a number of widgets together so they all request the same amount of space. This is typically useful when you want a column of widgets to have the same size, but you can't use a GtkTable widget.\n\nNote that size groups only affect the amount of space requested, not the size that the widgets finally receive. If you want the widgets in a GtkSizeGroup to actually be the same size, you need to pack them in such a way that they get the size they request and not more. For example, if you are packing your widgets into a table, you would not include the GTK_FILL flag.",
    keywords: [],
    component: SizeGroupDemo,
    sourceCode,
    resizable: false,
};
