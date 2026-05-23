import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkCheckButton, GtkDropDown, GtkFrame, GtkGrid, GtkLabel } from "@gtkx/react";
import { useCallback, useLayoutEffect, useRef, useState } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./sizegroup.tsx?raw";

const COLOR_OPTIONS = ["Red", "Green", "Blue"];
const DASH_OPTIONS = ["Solid", "Dashed", "Dotted"];
const END_OPTIONS = ["Square", "Round", "Double Arrow"];

function useSizeGroupRefs() {
    const dropdown1Ref = useRef<Gtk.DropDown | null>(null);
    const dropdown2Ref = useRef<Gtk.DropDown | null>(null);
    const dropdown3Ref = useRef<Gtk.DropDown | null>(null);
    const dropdown4Ref = useRef<Gtk.DropDown | null>(null);
    const label1Ref = useRef<Gtk.Label | null>(null);
    const label2Ref = useRef<Gtk.Label | null>(null);
    const label3Ref = useRef<Gtk.Label | null>(null);
    const label4Ref = useRef<Gtk.Label | null>(null);
    const sizeGroupRef = useRef<Gtk.SizeGroup | null>(null);
    return {
        dropdown1Ref,
        dropdown2Ref,
        dropdown3Ref,
        dropdown4Ref,
        label1Ref,
        label2Ref,
        label3Ref,
        label4Ref,
        sizeGroupRef,
    };
}

type SizeGroupRefs = ReturnType<typeof useSizeGroupRefs>;

function useSizeGroup(refs: SizeGroupRefs, groupingEnabled: boolean) {
    useLayoutEffect(() => {
        const sizeGroup = Gtk.SizeGroup.new(Gtk.SizeGroupMode.HORIZONTAL);
        refs.sizeGroupRef.current = sizeGroup;

        const dropdowns = [refs.dropdown1Ref, refs.dropdown2Ref, refs.dropdown3Ref, refs.dropdown4Ref];
        const labels = [refs.label1Ref, refs.label2Ref, refs.label3Ref, refs.label4Ref];

        for (let i = 0; i < dropdowns.length; i++) {
            const dropdown = dropdowns[i]?.current;
            const label = labels[i]?.current;
            if (dropdown) sizeGroup.addWidget(dropdown);
            if (label && dropdown) label.setMnemonicWidget(dropdown);
        }

        return () => {
            refs.sizeGroupRef.current = null;
        };
    }, [refs]);

    useLayoutEffect(() => {
        const sizeGroup = refs.sizeGroupRef.current;
        if (!sizeGroup) return;
        sizeGroup.setMode(groupingEnabled ? Gtk.SizeGroupMode.HORIZONTAL : Gtk.SizeGroupMode.NONE);
    }, [groupingEnabled, refs]);
}

interface DropdownRowProps {
    row: number;
    labelText: string;
    labelRef: React.RefObject<Gtk.Label | null>;
    dropdownRef: React.RefObject<Gtk.DropDown | null>;
    selectedId: string;
    options: readonly string[];
    onSelectionChanged: (id: string) => void;
}

const DropdownRow = ({
    row,
    labelText,
    labelRef,
    dropdownRef,
    selectedId,
    options,
    onSelectionChanged,
}: DropdownRowProps) => (
    <>
        <GtkGrid.Child column={0} row={row}>
            <GtkLabel ref={labelRef} label={labelText} useUnderline halign={Gtk.Align.START} hexpand />
        </GtkGrid.Child>
        <GtkGrid.Child column={1} row={row}>
            <GtkDropDown
                ref={dropdownRef}
                halign={Gtk.Align.END}
                valign={Gtk.Align.BASELINE_FILL}
                selectedId={selectedId}
                onSelectionChanged={onSelectionChanged}
                items={options.map((option) => ({ id: option, value: option }))}
            />
        </GtkGrid.Child>
    </>
);

function useSizeGroupState() {
    const [groupingEnabled, setGroupingEnabled] = useState(true);
    const [foreground, setForeground] = useState("Red");
    const [background, setBackground] = useState("Red");
    const [dashing, setDashing] = useState("Solid");
    const [lineEnd, setLineEnd] = useState("Square");
    return {
        groupingEnabled,
        setGroupingEnabled,
        foreground,
        setForeground,
        background,
        setBackground,
        dashing,
        setDashing,
        lineEnd,
        setLineEnd,
    };
}

type SizeGroupState = ReturnType<typeof useSizeGroupState>;

const ColorOptionsFrame = ({ state, refs }: { state: SizeGroupState; refs: SizeGroupRefs }) => (
    <GtkFrame name="color-options-frame" label="Color Options">
        <GtkGrid rowSpacing={5} columnSpacing={10} marginStart={5} marginEnd={5} marginTop={5} marginBottom={5}>
            <DropdownRow
                row={0}
                labelText="_Foreground"
                labelRef={refs.label1Ref}
                dropdownRef={refs.dropdown1Ref}
                selectedId={state.foreground}
                options={COLOR_OPTIONS}
                onSelectionChanged={state.setForeground}
            />
            <DropdownRow
                row={1}
                labelText="_Background"
                labelRef={refs.label2Ref}
                dropdownRef={refs.dropdown2Ref}
                selectedId={state.background}
                options={COLOR_OPTIONS}
                onSelectionChanged={state.setBackground}
            />
        </GtkGrid>
    </GtkFrame>
);

const LineOptionsFrame = ({ state, refs }: { state: SizeGroupState; refs: SizeGroupRefs }) => (
    <GtkFrame name="line-options-frame" label="Line Options">
        <GtkGrid rowSpacing={5} columnSpacing={10} marginStart={5} marginEnd={5} marginTop={5} marginBottom={5}>
            <DropdownRow
                row={0}
                labelText="_Dashing"
                labelRef={refs.label3Ref}
                dropdownRef={refs.dropdown3Ref}
                selectedId={state.dashing}
                options={DASH_OPTIONS}
                onSelectionChanged={state.setDashing}
            />
            <DropdownRow
                row={1}
                labelText="_Line ends"
                labelRef={refs.label4Ref}
                dropdownRef={refs.dropdown4Ref}
                selectedId={state.lineEnd}
                options={END_OPTIONS}
                onSelectionChanged={state.setLineEnd}
            />
        </GtkGrid>
    </GtkFrame>
);

const SizeGroupDemo = () => {
    const state = useSizeGroupState();
    const refs = useSizeGroupRefs();

    useSizeGroup(refs, state.groupingEnabled);

    const handleToggle = useCallback(
        (button: Gtk.CheckButton) => state.setGroupingEnabled(button.getActive()),
        [state],
    );

    return (
        <GtkBox
            orientation={Gtk.Orientation.VERTICAL}
            spacing={5}
            marginStart={5}
            marginEnd={5}
            marginTop={5}
            marginBottom={5}
        >
            <ColorOptionsFrame state={state} refs={refs} />
            <LineOptionsFrame state={state} refs={refs} />
            <GtkCheckButton
                name="enable-grouping-check"
                label="_Enable grouping"
                useUnderline
                active={state.groupingEnabled}
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
};
