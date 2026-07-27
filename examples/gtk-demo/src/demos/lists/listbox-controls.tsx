import { DropDown, SizeGroup } from "@gtkx/components";
import * as Gdk from "@gtkx/gi/gdk";
import * as Gtk from "@gtkx/gi/gtk";
import {
    GtkAdjustment,
    GtkBox,
    GtkCheckButton,
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
} from "@gtkx/jsx/gtk";
import { type ReactNode, useRef, useState } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./listbox-controls.tsx?raw";

type LabeledRowProps = {
    labelText: string;
    useUnderline?: boolean;
    activatable?: boolean;
    children: ReactNode;
};

type SwitchRowProps = {
    switchRef: React.RefObject<Gtk.Switch | null>;
    switchActive: boolean;
    setSwitchActive: React.Dispatch<React.SetStateAction<boolean>>;
};

type CheckRowProps = {
    checkRef: React.RefObject<Gtk.CheckButton | null>;
    checkActive: boolean;
    setCheckActive: React.Dispatch<React.SetStateAction<boolean>>;
};

type ClickHereRowProps = {
    imageRef: React.RefObject<Gtk.Image | null>;
    imageOpacity: number;
};

type RowToggles = {
    switchRef: React.RefObject<Gtk.Switch | null>;
    checkRef: React.RefObject<Gtk.CheckButton | null>;
    imageRef: React.RefObject<Gtk.Image | null>;
    setSwitchActive: React.Dispatch<React.SetStateAction<boolean>>;
    setCheckActive: React.Dispatch<React.SetStateAction<boolean>>;
    setImageOpacity: React.Dispatch<React.SetStateAction<number>>;
};

const listboxControlsDemo: Demo = {
    id: "listbox-controls",
    title: "List Box/Controls",
    description:
        "GtkListBox is well-suited for creating “button strips” — lists of controls for use in preference " +
        "dialogs or settings panels. To create this style of list, use the .rich-list style class.",
    keywords: [],
    component: ListBoxControlsDemo,
    sourceCode,
    defaultHeight: 400,
    windowTitle: "List Box — Controls",
};

function nextOpacity(opacity: number) {
    return opacity === 0 ? 1 : 0;
}

function activateRow(row: Gtk.ListBoxRow, toggles: RowToggles) {
    if (toggles.switchRef.current?.isAncestor(row)) {
        toggles.setSwitchActive((previous) => !previous);
    } else if (toggles.checkRef.current?.isAncestor(row)) {
        toggles.setCheckActive((previous) => !previous);
    } else if (toggles.imageRef.current?.isAncestor(row)) {
        toggles.setImageOpacity(nextOpacity);
    }
}

const LabeledRow = ({ labelText, useUnderline, activatable, children }: LabeledRowProps) => (
    <GtkListBoxRow selectable={false} activatable={activatable}>
        <GtkBox>
            <SizeGroup.Child
                component={GtkLabel}
                useUnderline={useUnderline}
                xalign={0}
                halign={Gtk.Align.START}
                valign={Gtk.Align.CENTER}
                hexpand
            >
                {labelText}
            </SizeGroup.Child>
            {children}
        </GtkBox>
    </GtkListBoxRow>
);

const SwitchRow = ({ switchRef, switchActive, setSwitchActive }: SwitchRowProps) => (
    <LabeledRow labelText="Switch">
        <GtkSwitch
            name="switch"
            ref={switchRef}
            halign={Gtk.Align.END}
            valign={Gtk.Align.CENTER}
            active={switchActive}
            onStateSet={() => {
                setSwitchActive((previous) => !previous);

                return Gdk.EVENT_STOP;
            }}
        />
    </LabeledRow>
);

const CheckRow = ({ checkRef, checkActive, setCheckActive }: CheckRowProps) => (
    <LabeledRow labelText="Check">
        <GtkCheckButton
            name="check"
            ref={checkRef}
            halign={Gtk.Align.END}
            valign={Gtk.Align.CENTER}
            marginStart={10}
            marginEnd={10}
            active={checkActive}
            onToggled={() => {
                setCheckActive((previous) => !previous);
            }}
        />
    </LabeledRow>
);

const ClickHereRow = ({ imageRef, imageOpacity }: ClickHereRowProps) => (
    <LabeledRow labelText="Click here!">
        <GtkImage
            name="click-here-image"
            ref={imageRef}
            iconName="object-select-symbolic"
            halign={Gtk.Align.END}
            valign={Gtk.Align.CENTER}
            marginStart={10}
            marginEnd={10}
            opacity={imageOpacity}
            accessibleRole={Gtk.AccessibleRole.STATUS}
        />
    </LabeledRow>
);

function Group1List() {
    const [switchActive, setSwitchActive] = useState(false);
    const [checkActive, setCheckActive] = useState(true);
    const [imageOpacity, setImageOpacity] = useState(0);
    const switchRef = useRef<Gtk.Switch | null>(null);
    const checkRef = useRef<Gtk.CheckButton | null>(null);
    const imageRef = useRef<Gtk.Image | null>(null);

    const handleRowActivated = (row: Gtk.ListBoxRow) => {
        activateRow(row, { switchRef, checkRef, imageRef, setSwitchActive, setCheckActive, setImageOpacity });
    };

    return (
        <GtkListBox
            name="group-1-list"
            selectionMode={Gtk.SelectionMode.NONE}
            cssClasses={["rich-list", "boxed-list"]}
            onRowActivated={handleRowActivated}
        >
            <SwitchRow switchRef={switchRef} switchActive={switchActive} setSwitchActive={setSwitchActive} />
            <CheckRow checkRef={checkRef} checkActive={checkActive} setCheckActive={setCheckActive} />
            <ClickHereRow imageRef={imageRef} imageOpacity={imageOpacity} />
        </GtkListBox>
    );
}

const valueAdjustment = () => <GtkAdjustment value={50} upper={100} stepIncrement={1} pageIncrement={10} />;

const Group2List = () => {
    return (
        <GtkListBox name="group-2-list" selectionMode={Gtk.SelectionMode.NONE} cssClasses={["rich-list", "boxed-list"]}>
            <LabeledRow labelText="_Scale" useUnderline activatable={false}>
                <GtkScale
                    name="scale"
                    halign={Gtk.Align.END}
                    valign={Gtk.Align.CENTER}
                    drawValue={false}
                    widthRequest={150}
                    adjustment={valueAdjustment()}
                />
            </LabeledRow>
            <LabeledRow labelText="S_pinbutton" useUnderline activatable={false}>
                <GtkSpinButton
                    name="spin"
                    halign={Gtk.Align.END}
                    valign={Gtk.Align.CENTER}
                    adjustment={valueAdjustment()}
                />
            </LabeledRow>
            <LabeledRow labelText="_Dropdown" useUnderline activatable={false}>
                <DropDown
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
            </LabeledRow>
            <LabeledRow labelText="_Entry" useUnderline activatable={false}>
                <GtkEntry name="entry" halign={Gtk.Align.END} valign={Gtk.Align.CENTER} placeholderText="Type here…" />
            </LabeledRow>
        </GtkListBox>
    );
};

function ListBoxControlsDemo() {
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
                    <SizeGroup mode={Gtk.SizeGroupMode.HORIZONTAL}>
                        <GtkLabel xalign={0} marginBottom={10} cssClasses={["title-2"]}>
                            Group 1
                        </GtkLabel>
                        <Group1List />

                        <GtkLabel xalign={0} marginTop={30} marginBottom={10} cssClasses={["title-2"]}>
                            Group 2
                        </GtkLabel>
                        <Group2List />
                    </SizeGroup>
                </GtkBox>
            </GtkViewport>
        </GtkScrolledWindow>
    );
}

export { listboxControlsDemo };
