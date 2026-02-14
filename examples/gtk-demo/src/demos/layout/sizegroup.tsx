import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkCheckButton, GtkDropDown, GtkFrame, GtkGrid, GtkLabel, x } from "@gtkx/react";
import { useCallback, useLayoutEffect, useRef, useState } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./sizegroup.tsx?raw";

const COLOR_OPTIONS = ["Red", "Green", "Blue"];
const DASH_OPTIONS = ["Solid", "Dashed", "Dotted"];
const END_OPTIONS = ["Square", "Round", "Double Arrow"];

const SizeGroupDemo = () => {
    const [groupingEnabled, setGroupingEnabled] = useState(true);
    const [foreground, setForeground] = useState("Red");
    const [background, setBackground] = useState("Red");
    const [dashing, setDashing] = useState("Solid");
    const [lineEnd, setLineEnd] = useState("Square");
    const sizeGroupRef = useRef<Gtk.SizeGroup | null>(null);
    const dropdown1Ref = useRef<Gtk.DropDown | null>(null);
    const dropdown2Ref = useRef<Gtk.DropDown | null>(null);
    const dropdown3Ref = useRef<Gtk.DropDown | null>(null);
    const dropdown4Ref = useRef<Gtk.DropDown | null>(null);
    const label1Ref = useRef<Gtk.Label | null>(null);
    const label2Ref = useRef<Gtk.Label | null>(null);
    const label3Ref = useRef<Gtk.Label | null>(null);
    const label4Ref = useRef<Gtk.Label | null>(null);

    useLayoutEffect(() => {
        const sizeGroup = new Gtk.SizeGroup(Gtk.SizeGroupMode.HORIZONTAL);
        sizeGroupRef.current = sizeGroup;

        const dropdowns = [dropdown1Ref, dropdown2Ref, dropdown3Ref, dropdown4Ref];
        const labels = [label1Ref, label2Ref, label3Ref, label4Ref];

        for (let i = 0; i < dropdowns.length; i++) {
            const dropdown = dropdowns[i]?.current;
            const label = labels[i]?.current;
            if (dropdown) {
                sizeGroup.addWidget(dropdown);
            }
            if (label && dropdown) {
                label.setMnemonicWidget(dropdown);
            }
        }

        return () => {
            sizeGroupRef.current = null;
        };
    }, []);

    useLayoutEffect(() => {
        const sizeGroup = sizeGroupRef.current;
        if (!sizeGroup) return;

        if (groupingEnabled) {
            sizeGroup.setMode(Gtk.SizeGroupMode.HORIZONTAL);
        } else {
            sizeGroup.setMode(Gtk.SizeGroupMode.NONE);
        }
    }, [groupingEnabled]);

    const handleToggle = useCallback((button: Gtk.CheckButton) => {
        setGroupingEnabled(button.getActive());
    }, []);

    return (
        <GtkBox
            orientation={Gtk.Orientation.VERTICAL}
            spacing={5}
            marginStart={5}
            marginEnd={5}
            marginTop={5}
            marginBottom={5}
        >
            <GtkFrame label="Color Options">
                <GtkGrid rowSpacing={5} columnSpacing={10} marginStart={5} marginEnd={5} marginTop={5} marginBottom={5}>
                    <x.GridChild column={0} row={0}>
                        <GtkLabel ref={label1Ref} label="_Foreground" useUnderline halign={Gtk.Align.START} hexpand />
                    </x.GridChild>
                    <x.GridChild column={1} row={0}>
                        <GtkDropDown
                            ref={dropdown1Ref}
                            halign={Gtk.Align.END}
                            valign={Gtk.Align.BASELINE_FILL}
                            selectedId={foreground}
                            onSelectionChanged={setForeground}
                        >
                            {COLOR_OPTIONS.map((option) => (
                                <x.ListItem key={option} id={option} value={option} />
                            ))}
                        </GtkDropDown>
                    </x.GridChild>

                    <x.GridChild column={0} row={1}>
                        <GtkLabel ref={label2Ref} label="_Background" useUnderline halign={Gtk.Align.START} hexpand />
                    </x.GridChild>
                    <x.GridChild column={1} row={1}>
                        <GtkDropDown
                            ref={dropdown2Ref}
                            halign={Gtk.Align.END}
                            valign={Gtk.Align.BASELINE_FILL}
                            selectedId={background}
                            onSelectionChanged={setBackground}
                        >
                            {COLOR_OPTIONS.map((option) => (
                                <x.ListItem key={option} id={option} value={option} />
                            ))}
                        </GtkDropDown>
                    </x.GridChild>
                </GtkGrid>
            </GtkFrame>

            <GtkFrame label="Line Options">
                <GtkGrid rowSpacing={5} columnSpacing={10} marginStart={5} marginEnd={5} marginTop={5} marginBottom={5}>
                    <x.GridChild column={0} row={0}>
                        <GtkLabel ref={label3Ref} label="_Dashing" useUnderline halign={Gtk.Align.START} hexpand />
                    </x.GridChild>
                    <x.GridChild column={1} row={0}>
                        <GtkDropDown
                            ref={dropdown3Ref}
                            halign={Gtk.Align.END}
                            valign={Gtk.Align.BASELINE_FILL}
                            selectedId={dashing}
                            onSelectionChanged={setDashing}
                        >
                            {DASH_OPTIONS.map((option) => (
                                <x.ListItem key={option} id={option} value={option} />
                            ))}
                        </GtkDropDown>
                    </x.GridChild>

                    <x.GridChild column={0} row={1}>
                        <GtkLabel ref={label4Ref} label="_Line ends" useUnderline halign={Gtk.Align.START} hexpand />
                    </x.GridChild>
                    <x.GridChild column={1} row={1}>
                        <GtkDropDown
                            ref={dropdown4Ref}
                            halign={Gtk.Align.END}
                            valign={Gtk.Align.BASELINE_FILL}
                            selectedId={lineEnd}
                            onSelectionChanged={setLineEnd}
                        >
                            {END_OPTIONS.map((option) => (
                                <x.ListItem key={option} id={option} value={option} />
                            ))}
                        </GtkDropDown>
                    </x.GridChild>
                </GtkGrid>
            </GtkFrame>

            <GtkCheckButton label="_Enable grouping" useUnderline active={groupingEnabled} onToggled={handleToggle} />
        </GtkBox>
    );
};

export const sizegroupDemo: Demo = {
    id: "sizegroup",
    title: "Size Groups",
    description:
        "GtkSizeGroup provides a mechanism for grouping a number of widgets together so they all request the same amount of space. This is typically useful when you want a column of widgets to have the same size, but you can't use a GtkGrid widget.",
    keywords: ["sizegroup", "size", "width", "alignment", "GtkSizeGroup"],
    component: SizeGroupDemo,
    sourceCode,
};
