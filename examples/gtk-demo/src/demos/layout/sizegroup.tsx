import { DropDown } from "@gtkx/components";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkCheckButton, GtkFrame, GtkLabel, GtkSizeGroup } from "@gtkx/jsx/gtk";
import { type Dispatch, type ReactNode, type SetStateAction, useCallback, useState } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./sizegroup.tsx?raw";

type Selection = Record<string, string>;
type Dropdowns = Record<string, Gtk.DropDown | null>;

type RowSpec = {
    labelText: string;
    options: string[];
};

type FrameSpec = {
    name: string;
    label: string;
    rows: RowSpec[];
};

type RowState = {
    selection: Selection;
    dropdowns: Dropdowns;
    setSelection: Dispatch<SetStateAction<Selection>>;
    setDropdowns: Dispatch<SetStateAction<Dropdowns>>;
};

type DropdownRowProps = RowState & {
    row: RowSpec;
};

type OptionsFrameProps = RowState & {
    frame: FrameSpec;
};

const COLOR_OPTIONS = ["Red", "Green", "Blue"];
const DASH_OPTIONS = ["Solid", "Dashed", "Dotted"];
const END_OPTIONS = ["Square", "Round", "Double Arrow"];

const FRAMES: FrameSpec[] = [
    {
        name: "color-options-frame",
        label: "Color Options",
        rows: [
            { labelText: "_Foreground", options: COLOR_OPTIONS },
            { labelText: "_Background", options: COLOR_OPTIONS },
        ],
    },
    {
        name: "line-options-frame",
        label: "Line Options",
        rows: [
            { labelText: "_Dashing", options: DASH_OPTIONS },
            { labelText: "_Line ends", options: END_OPTIONS },
        ],
    },
];

const INITIAL_SELECTION: Selection = Object.fromEntries(
    FRAMES.flatMap((frame) => frame.rows).map((row) => [row.labelText, row.options[0] ?? ""]),
);

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

const groupedDropdowns = (dropdowns: Dropdowns): Gtk.Widget[] =>
    Object.values(dropdowns).filter((dropdown) => dropdown !== null);

function DropdownRow({ row, selection, dropdowns, setSelection, setDropdowns }: DropdownRowProps): ReactNode {
    const { labelText, options } = row;

    const handleSelectionChanged = useCallback(
        (id: string) => {
            setSelection((previous) => ({ ...previous, [labelText]: id }));
        },
        [labelText, setSelection],
    );

    const captureDropdown = useCallback(
        (dropdown: Gtk.DropDown | null) => {
            setDropdowns((previous) => ({ ...previous, [labelText]: dropdown }));
        },
        [labelText, setDropdowns],
    );

    return (
        <GtkBox orientation={Gtk.Orientation.HORIZONTAL} spacing={10}>
            <GtkLabel useUnderline halign={Gtk.Align.START} hexpand mnemonicWidget={dropdowns[labelText]}>
                {labelText}
            </GtkLabel>
            <DropDown
                ref={captureDropdown}
                halign={Gtk.Align.END}
                valign={Gtk.Align.BASELINE_FILL}
                selectedId={selection[labelText]}
                onSelectionChanged={handleSelectionChanged}
                items={options.map((option) => ({ id: option, value: option }))}
            />
        </GtkBox>
    );
}

const OptionsFrame = ({ frame, ...state }: OptionsFrameProps) => (
    <GtkFrame name={frame.name} label={frame.label}>
        <GtkBox
            orientation={Gtk.Orientation.VERTICAL}
            spacing={5}
            marginStart={5}
            marginEnd={5}
            marginTop={5}
            marginBottom={5}
        >
            {frame.rows.map((row) => (
                <DropdownRow key={row.labelText} row={row} {...state} />
            ))}
        </GtkBox>
    </GtkFrame>
);

function SizeGroupDemo() {
    const [groupingEnabled, setGroupingEnabled] = useState(true);
    const [selection, setSelection] = useState<Selection>(INITIAL_SELECTION);
    const [dropdowns, setDropdowns] = useState<Dropdowns>({});

    const handleToggle = (button: Gtk.CheckButton) => {
        setGroupingEnabled(button.getActive());
    };

    const mode = groupingEnabled ? Gtk.SizeGroupMode.HORIZONTAL : Gtk.SizeGroupMode.NONE;
    const state = { selection, dropdowns, setSelection, setDropdowns };

    return (
        <GtkBox
            orientation={Gtk.Orientation.VERTICAL}
            spacing={5}
            marginStart={5}
            marginEnd={5}
            marginTop={5}
            marginBottom={5}
        >
            <GtkSizeGroup mode={mode} widgets={groupedDropdowns(dropdowns)} />
            {FRAMES.map((frame) => (
                <OptionsFrame key={frame.name} frame={frame} {...state} />
            ))}
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
