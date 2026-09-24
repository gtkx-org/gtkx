import { DropDown } from "@gtkx/components";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkCheckButton, GtkFrame, GtkLabel, GtkSizeGroup } from "@gtkx/jsx/gtk";
import { type Dispatch, type ReactNode, type SetStateAction, useCallback, useState } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./sizegroup.tsx?raw";

type RowId = "foreground" | "background" | "dashing" | "line-ends";
type Dropdowns = Record<RowId, Gtk.DropDown | null>;

type RowSpec = {
    id: RowId;
    labelText: string;
    options: readonly [string, ...string[]];
};

type FrameSpec = {
    name: string;
    label: string;
    rows: RowSpec[];
};

type RowState = {
    dropdowns: Dropdowns;
    setDropdowns: Dispatch<SetStateAction<Dropdowns>>;
};

type DropdownRowProps = RowState & {
    row: RowSpec;
};

type OptionsFrameProps = RowState & {
    frame: FrameSpec;
};

const COLOR_OPTIONS = ["Red", "Green", "Blue"] as const;
const DASH_OPTIONS = ["Solid", "Dashed", "Dotted"] as const;
const END_OPTIONS = ["Square", "Round", "Double Arrow"] as const;

const FRAMES: FrameSpec[] = [
    {
        name: "color-options-frame",
        label: "Color Options",
        rows: [
            { id: "foreground", labelText: "_Foreground", options: COLOR_OPTIONS },
            { id: "background", labelText: "_Background", options: COLOR_OPTIONS },
        ],
    },
    {
        name: "line-options-frame",
        label: "Line Options",
        rows: [
            { id: "dashing", labelText: "_Dashing", options: DASH_OPTIONS },
            { id: "line-ends", labelText: "_Line ends", options: END_OPTIONS },
        ],
    },
];

const INITIAL_DROPDOWNS: Dropdowns = {
    foreground: null,
    background: null,
    dashing: null,
    "line-ends": null,
};

const sizegroupDemo: Demo = {
    id: "sizegroup",
    title: "Size Groups",
    description:
        "GtkSizeGroup provides a mechanism for grouping a number of widgets together so they all " +
        "request the same amount of space. This demo passes selected drop-down widgets to a declarative " +
        "GtkSizeGroup so their columns stay aligned.",
    keywords: [],
    component: SizeGroupDemo,
    sourceCode,
    isResizable: false,
};

const groupedDropdowns = (dropdowns: Dropdowns): Gtk.Widget[] =>
    Object.values(dropdowns).filter((dropdown) => dropdown !== null);

function DropdownRow({ row, dropdowns, setDropdowns }: DropdownRowProps): ReactNode {
    const { id, labelText, options } = row;
    const [selectedId, setSelectedId] = useState(options[0]);

    const handleSelectionChanged = useCallback(
        (nextId: string | null) => {
            if (nextId === null) {
                return;
            }

            setSelectedId(nextId);
        },
        [],
    );

    const captureDropdown = useCallback(
        (dropdown: Gtk.DropDown | null) => {
            setDropdowns((previous) => ({ ...previous, [id]: dropdown }));
        },
        [id, setDropdowns],
    );

    return (
        <GtkBox orientation={Gtk.Orientation.HORIZONTAL} spacing={10}>
            <GtkLabel useUnderline halign={Gtk.Align.START} hexpand mnemonicWidget={dropdowns[id]}>
                {labelText}
            </GtkLabel>
            <DropDown
                ref={captureDropdown}
                halign={Gtk.Align.END}
                valign={Gtk.Align.BASELINE_FILL}
                selectedId={selectedId}
                onSelectionChanged={handleSelectionChanged}
                items={options.map((option) => ({ id: option, value: option }))}
            />
        </GtkBox>
    );
}

const PaddedColumn = ({ children }: { children: ReactNode }) => (
    <GtkBox
        orientation={Gtk.Orientation.VERTICAL}
        spacing={5}
        marginStart={5}
        marginEnd={5}
        marginTop={5}
        marginBottom={5}
    >
        {children}
    </GtkBox>
);

const OptionsFrame = ({ frame, ...state }: OptionsFrameProps) => (
    <GtkFrame name={frame.name} label={frame.label}>
        <PaddedColumn>
            {frame.rows.map((row) => (
                <DropdownRow key={row.labelText} row={row} {...state} />
            ))}
        </PaddedColumn>
    </GtkFrame>
);

function SizeGroupDemo() {
    const [isGroupingEnabled, setIsGroupingEnabled] = useState(true);
    const [dropdowns, setDropdowns] = useState<Dropdowns>(INITIAL_DROPDOWNS);

    const handleToggle = (button: Gtk.CheckButton) => {
        setIsGroupingEnabled(button.getActive());
    };

    const mode = isGroupingEnabled ? Gtk.SizeGroupMode.HORIZONTAL : Gtk.SizeGroupMode.NONE;
    const state = { dropdowns, setDropdowns };

    return (
        <PaddedColumn>
            <GtkSizeGroup mode={mode} widgets={groupedDropdowns(dropdowns)} />
            {FRAMES.map((frame) => (
                <OptionsFrame key={frame.name} frame={frame} {...state} />
            ))}
            <GtkCheckButton
                name="enable-grouping-check"
                label="_Enable grouping"
                useUnderline
                active={isGroupingEnabled}
                onToggled={handleToggle}
            />
        </PaddedColumn>
    );
}

export { sizegroupDemo };
