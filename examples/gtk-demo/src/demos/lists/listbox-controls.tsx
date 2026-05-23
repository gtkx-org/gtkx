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
} from "@gtkx/react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./listbox-controls.tsx?raw";

interface Group1ListProps {
    labelRefs: React.RefObject<(Gtk.Label | null)[]>;
    switchRef: React.RefObject<Gtk.Switch | null>;
    checkRef: React.RefObject<Gtk.CheckButton | null>;
    imageRef: React.RefObject<Gtk.Image | null>;
    switchActive: boolean;
    setSwitchActive: React.Dispatch<React.SetStateAction<boolean>>;
    checkActive: boolean;
    setCheckActive: React.Dispatch<React.SetStateAction<boolean>>;
    imageOpacity: number;
    onRowActivated: (row: Gtk.ListBoxRow) => void;
}

const Group1List = ({
    labelRefs,
    switchRef,
    checkRef,
    imageRef,
    switchActive,
    setSwitchActive,
    checkActive,
    setCheckActive,
    imageOpacity,
    onRowActivated,
}: Group1ListProps) => (
    <GtkListBox
        name="group-1-list"
        selectionMode={Gtk.SelectionMode.NONE}
        cssClasses={["rich-list", "boxed-list"]}
        onRowActivated={onRowActivated}
    >
        <SwitchRow labelRefs={labelRefs} switchRef={switchRef} active={switchActive} setActive={setSwitchActive} />
        <CheckRow labelRefs={labelRefs} checkRef={checkRef} active={checkActive} setActive={setCheckActive} />
        <ClickHereRow labelRefs={labelRefs} imageRef={imageRef} opacity={imageOpacity} />
    </GtkListBox>
);

interface SwitchRowProps {
    labelRefs: React.RefObject<(Gtk.Label | null)[]>;
    switchRef: React.RefObject<Gtk.Switch | null>;
    active: boolean;
    setActive: React.Dispatch<React.SetStateAction<boolean>>;
}

const SwitchRow = ({ labelRefs, switchRef, active, setActive }: SwitchRowProps) => (
    <GtkListBoxRow selectable={false}>
        <GtkBox>
            <GtkLabel
                ref={(r) => {
                    labelRefs.current[0] = r;
                }}
                label="Switch"
                mnemonicWidget={switchRef.current}
                xalign={0}
                halign={Gtk.Align.START}
                valign={Gtk.Align.CENTER}
                hexpand
            />
            <GtkSwitch
                name="switch"
                ref={switchRef}
                halign={Gtk.Align.END}
                valign={Gtk.Align.CENTER}
                active={active}
                onStateSet={() => {
                    setActive((prev) => !prev);
                    return true;
                }}
            />
        </GtkBox>
    </GtkListBoxRow>
);

interface CheckRowProps {
    labelRefs: React.RefObject<(Gtk.Label | null)[]>;
    checkRef: React.RefObject<Gtk.CheckButton | null>;
    active: boolean;
    setActive: React.Dispatch<React.SetStateAction<boolean>>;
}

const CheckRow = ({ labelRefs, checkRef, active, setActive }: CheckRowProps) => (
    <GtkListBoxRow selectable={false}>
        <GtkBox>
            <GtkLabel
                ref={(r) => {
                    labelRefs.current[1] = r;
                }}
                label="Check"
                mnemonicWidget={checkRef.current}
                xalign={0}
                halign={Gtk.Align.START}
                valign={Gtk.Align.CENTER}
                hexpand
            />
            <GtkCheckButton
                name="check"
                ref={checkRef}
                halign={Gtk.Align.END}
                valign={Gtk.Align.CENTER}
                marginStart={10}
                marginEnd={10}
                active={active}
                onToggled={() => setActive((prev) => !prev)}
            />
        </GtkBox>
    </GtkListBoxRow>
);

interface ClickHereRowProps {
    labelRefs: React.RefObject<(Gtk.Label | null)[]>;
    imageRef: React.RefObject<Gtk.Image | null>;
    opacity: number;
}

const ClickHereRow = ({ labelRefs, imageRef, opacity }: ClickHereRowProps) => (
    <GtkListBoxRow selectable={false}>
        <GtkBox>
            <GtkLabel
                ref={(r) => {
                    labelRefs.current[2] = r;
                }}
                label="Click here!"
                mnemonicWidget={imageRef.current}
                xalign={0}
                halign={Gtk.Align.START}
                valign={Gtk.Align.CENTER}
                hexpand
            />
            <GtkImage
                name="click-here-image"
                ref={imageRef}
                iconName="object-select-symbolic"
                halign={Gtk.Align.END}
                valign={Gtk.Align.CENTER}
                marginStart={10}
                marginEnd={10}
                opacity={opacity}
                accessibleRole={Gtk.AccessibleRole.STATUS}
            />
        </GtkBox>
    </GtkListBoxRow>
);

const Group2List = ({ labelRefs }: { labelRefs: React.RefObject<(Gtk.Label | null)[]> }) => (
    <GtkListBox name="group-2-list" selectionMode={Gtk.SelectionMode.NONE} cssClasses={["rich-list", "boxed-list"]}>
        <ScaleRow labelRefs={labelRefs} />
        <SpinRow labelRefs={labelRefs} />
        <DropdownRow labelRefs={labelRefs} />
        <EntryRow labelRefs={labelRefs} />
    </GtkListBox>
);

const ScaleRow = ({ labelRefs }: { labelRefs: React.RefObject<(Gtk.Label | null)[]> }) => (
    <GtkListBoxRow selectable={false} activatable={false}>
        <GtkBox>
            <GtkLabel
                ref={(r) => {
                    labelRefs.current[3] = r;
                }}
                label="_Scale"
                useUnderline
                xalign={0}
                halign={Gtk.Align.START}
                valign={Gtk.Align.CENTER}
                hexpand
            />
            <GtkScale
                name="scale"
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
);

const SpinRow = ({ labelRefs }: { labelRefs: React.RefObject<(Gtk.Label | null)[]> }) => (
    <GtkListBoxRow selectable={false} activatable={false}>
        <GtkBox>
            <GtkLabel
                ref={(r) => {
                    labelRefs.current[4] = r;
                }}
                label="S_pinbutton"
                useUnderline
                xalign={0}
                halign={Gtk.Align.START}
                valign={Gtk.Align.CENTER}
                hexpand
            />
            <GtkSpinButton
                name="spin"
                halign={Gtk.Align.END}
                valign={Gtk.Align.CENTER}
                upper={100}
                value={50}
                stepIncrement={1}
                pageIncrement={10}
            />
        </GtkBox>
    </GtkListBoxRow>
);

const DropdownRow = ({ labelRefs }: { labelRefs: React.RefObject<(Gtk.Label | null)[]> }) => (
    <GtkListBoxRow selectable={false} activatable={false}>
        <GtkBox>
            <GtkLabel
                ref={(r) => {
                    labelRefs.current[5] = r;
                }}
                label="_Dropdown"
                useUnderline
                xalign={0}
                halign={Gtk.Align.START}
                valign={Gtk.Align.CENTER}
                hexpand
            />
            <GtkDropDown
                name="dropdown"
                halign={Gtk.Align.END}
                valign={Gtk.Align.CENTER}
                items={[
                    { id: "1", value: "Choice 1" },
                    { id: "2", value: "Choice 2" },
                    { id: "3", value: "Choice 3" },
                    { id: "4", value: "Choice 4" },
                ]}
            />
        </GtkBox>
    </GtkListBoxRow>
);

const EntryRow = ({ labelRefs }: { labelRefs: React.RefObject<(Gtk.Label | null)[]> }) => (
    <GtkListBoxRow selectable={false} activatable={false}>
        <GtkBox>
            <GtkLabel
                ref={(r) => {
                    labelRefs.current[6] = r;
                }}
                label="_Entry"
                useUnderline
                xalign={0}
                halign={Gtk.Align.START}
                valign={Gtk.Align.CENTER}
                hexpand
            />
            <GtkEntry name="entry" halign={Gtk.Align.END} valign={Gtk.Align.CENTER} placeholderText="Type here…" />
        </GtkBox>
    </GtkListBoxRow>
);

const ListBoxControlsDemo = () => {
    const [switchActive, setSwitchActive] = useState(false);
    const [checkActive, setCheckActive] = useState(true);
    const [imageOpacity, setImageOpacity] = useState(0);

    const switchRef = useRef<Gtk.Switch | null>(null);
    const checkRef = useRef<Gtk.CheckButton | null>(null);
    const imageRef = useRef<Gtk.Image | null>(null);
    const labelRefs = useRef<(Gtk.Label | null)[]>([]);

    useEffect(() => {
        const sizeGroup = Gtk.SizeGroup.new(Gtk.SizeGroupMode.HORIZONTAL);
        for (const label of labelRefs.current) {
            if (label) sizeGroup.addWidget(label);
        }
    }, []);

    const handleRowActivated = useCallback((row: Gtk.ListBoxRow) => {
        const sw = switchRef.current;
        const chk = checkRef.current;
        const img = imageRef.current;
        if (sw?.isAncestor(row)) setSwitchActive((prev) => !prev);
        else if (chk?.isAncestor(row)) setCheckActive((prev) => !prev);
        else if (img?.isAncestor(row)) setImageOpacity((prev) => (prev === 0 ? 1 : 0));
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
                    <Group1List
                        labelRefs={labelRefs}
                        switchRef={switchRef}
                        checkRef={checkRef}
                        imageRef={imageRef}
                        switchActive={switchActive}
                        setSwitchActive={setSwitchActive}
                        checkActive={checkActive}
                        setCheckActive={setCheckActive}
                        imageOpacity={imageOpacity}
                        onRowActivated={handleRowActivated}
                    />

                    <GtkLabel label="Group 2" xalign={0} marginTop={30} marginBottom={10} cssClasses={["title-2"]} />
                    <Group2List labelRefs={labelRefs} />
                </GtkBox>
            </GtkViewport>
        </GtkScrolledWindow>
    );
};

export const listboxControlsDemo: Demo = {
    id: "listbox-controls",
    title: "List Box/Controls",
    description:
        "GtkListBox is well-suited for creating “button strips” — lists of controls for use in preference dialogs or settings panels. To create this style of list, use the .rich-list style class.",
    keywords: [],
    component: ListBoxControlsDemo,
    sourceCode,
    defaultHeight: 400,
};
