import * as Gtk from "@gtkx/ffi/gtk";
import {
    GtkBox,
    GtkCheckButton,
    GtkDropDown,
    GtkEntry,
    GtkImage,
    GtkLabel,
    GtkListBox,
    GtkListBoxRow,
    GtkScale,
    GtkScrolledWindow,
    GtkSpinButton,
    GtkSwitch,
    GtkViewport,
    x,
} from "@gtkx/react";
import { useCallback, useRef, useState } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./listbox-controls.tsx?raw";

const ListBoxControlsDemo = () => {
    const [switchActive, setSwitchActive] = useState(false);
    const [checkActive, setCheckActive] = useState(true);
    const [imageOpacity, setImageOpacity] = useState(0);

    const switchRef = useRef<Gtk.Switch | null>(null);
    const checkRef = useRef<Gtk.CheckButton | null>(null);
    const imageRef = useRef<Gtk.Image | null>(null);

    const handleRowActivated = useCallback((row: Gtk.ListBoxRow) => {
        const sw = switchRef.current;
        const chk = checkRef.current;
        const img = imageRef.current;

        if (sw?.isAncestor(row)) {
            setSwitchActive((prev) => !prev);
        } else if (chk?.isAncestor(row)) {
            setCheckActive((prev) => !prev);
        } else if (img?.isAncestor(row)) {
            setImageOpacity((prev) => (prev === 0 ? 1 : 0));
        }
    }, []);

    return (
        <GtkScrolledWindow hscrollbarPolicy={Gtk.PolicyType.NEVER} minContentHeight={200} vexpand>
            <GtkViewport scrollToFocus>
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    marginStart={60}
                    marginEnd={60}
                    marginTop={30}
                    marginBottom={30}
                >
                    <GtkLabel label="Group 1" xalign={0} marginBottom={10} cssClasses={["title-2"]} />

                    <GtkListBox
                        selectionMode={Gtk.SelectionMode.NONE}
                        cssClasses={["rich-list", "boxed-list"]}
                        onRowActivated={handleRowActivated}
                    >
                        <GtkListBoxRow selectable={false}>
                            <GtkBox>
                                <GtkLabel
                                    label="Switch"
                                    xalign={0}
                                    halign={Gtk.Align.START}
                                    valign={Gtk.Align.CENTER}
                                    hexpand
                                />
                                <GtkSwitch
                                    ref={switchRef}
                                    halign={Gtk.Align.END}
                                    valign={Gtk.Align.CENTER}
                                    active={switchActive}
                                    onStateSet={() => {
                                        setSwitchActive((prev) => !prev);
                                        return true;
                                    }}
                                />
                            </GtkBox>
                        </GtkListBoxRow>

                        <GtkListBoxRow selectable={false}>
                            <GtkBox>
                                <GtkLabel
                                    label="Check"
                                    xalign={0}
                                    halign={Gtk.Align.START}
                                    valign={Gtk.Align.CENTER}
                                    hexpand
                                />
                                <GtkCheckButton
                                    ref={checkRef}
                                    halign={Gtk.Align.END}
                                    valign={Gtk.Align.CENTER}
                                    marginStart={10}
                                    marginEnd={10}
                                    active={checkActive}
                                    onToggled={() => setCheckActive((prev) => !prev)}
                                />
                            </GtkBox>
                        </GtkListBoxRow>

                        <GtkListBoxRow selectable={false}>
                            <GtkBox>
                                <GtkLabel
                                    label="Click here!"
                                    xalign={0}
                                    halign={Gtk.Align.START}
                                    valign={Gtk.Align.CENTER}
                                    hexpand
                                />
                                <GtkImage
                                    ref={imageRef}
                                    iconName="object-select-symbolic"
                                    halign={Gtk.Align.END}
                                    valign={Gtk.Align.CENTER}
                                    marginStart={10}
                                    marginEnd={10}
                                    opacity={imageOpacity}
                                />
                            </GtkBox>
                        </GtkListBoxRow>
                    </GtkListBox>

                    <GtkLabel label="Group 2" xalign={0} marginTop={30} marginBottom={10} cssClasses={["title-2"]} />

                    <GtkListBox selectionMode={Gtk.SelectionMode.NONE} cssClasses={["rich-list", "boxed-list"]}>
                        <GtkListBoxRow selectable={false} activatable={false}>
                            <GtkBox>
                                <GtkLabel
                                    label="Scale"
                                    xalign={0}
                                    halign={Gtk.Align.START}
                                    valign={Gtk.Align.CENTER}
                                    hexpand
                                />
                                <GtkScale
                                    halign={Gtk.Align.END}
                                    valign={Gtk.Align.CENTER}
                                    drawValue={false}
                                    widthRequest={150}
                                    upper={100}
                                    value={50}
                                    stepIncrement={1}
                                    pageIncrement={10}
                                />
                            </GtkBox>
                        </GtkListBoxRow>

                        <GtkListBoxRow selectable={false} activatable={false}>
                            <GtkBox>
                                <GtkLabel
                                    label="Spinbutton"
                                    xalign={0}
                                    halign={Gtk.Align.START}
                                    valign={Gtk.Align.CENTER}
                                    hexpand
                                />
                                <GtkSpinButton
                                    halign={Gtk.Align.END}
                                    valign={Gtk.Align.CENTER}
                                    upper={100}
                                    value={50}
                                    stepIncrement={1}
                                    pageIncrement={10}
                                />
                            </GtkBox>
                        </GtkListBoxRow>

                        <GtkListBoxRow selectable={false} activatable={false}>
                            <GtkBox>
                                <GtkLabel
                                    label="Dropdown"
                                    xalign={0}
                                    halign={Gtk.Align.START}
                                    valign={Gtk.Align.CENTER}
                                    hexpand
                                />
                                <GtkDropDown halign={Gtk.Align.END} valign={Gtk.Align.CENTER}>
                                    <x.ListItem id="1" value="Choice 1" />
                                    <x.ListItem id="2" value="Choice 2" />
                                    <x.ListItem id="3" value="Choice 3" />
                                    <x.ListItem id="4" value="Choice 4" />
                                </GtkDropDown>
                            </GtkBox>
                        </GtkListBoxRow>

                        <GtkListBoxRow selectable={false} activatable={false}>
                            <GtkBox>
                                <GtkLabel
                                    label="Entry"
                                    xalign={0}
                                    halign={Gtk.Align.START}
                                    valign={Gtk.Align.CENTER}
                                    hexpand
                                />
                                <GtkEntry
                                    halign={Gtk.Align.END}
                                    valign={Gtk.Align.CENTER}
                                    placeholderText="Type here…"
                                />
                            </GtkBox>
                        </GtkListBoxRow>
                    </GtkListBox>
                </GtkBox>
            </GtkViewport>
        </GtkScrolledWindow>
    );
};

export const listboxControlsDemo: Demo = {
    id: "listbox-controls",
    title: "List Box/Controls",
    description:
        "GtkListBox is well-suited for creating button strips — lists of controls for use in preference dialogs or settings panels.",
    keywords: ["listbox", "controls", "switch", "check", "scale", "spinbutton", "dropdown", "entry", "rich-list"],
    component: ListBoxControlsDemo,
    sourceCode,
};
