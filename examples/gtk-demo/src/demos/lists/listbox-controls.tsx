import * as Gtk from "@gtkx/gi/gtk";
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
    GtkSizeGroup,
    GtkSpinButton,
    GtkSwitch,
    GtkViewport,
} from "@gtkx/jsx/gtk";
import { useAdjustment } from "@gtkx/react";
import { type ReactNode, type Ref, useCallback, useRef, useState } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./listbox-controls.tsx?raw";

interface LabeledRowProps {
    labelText: string;
    labelRef?: Ref<Gtk.Label | null>;
    useUnderline?: boolean;
    activatable?: boolean;
    mnemonicWidget?: Gtk.Widget | null;
    children: ReactNode;
}

const LabeledRow = ({ labelText, labelRef, useUnderline, activatable, mnemonicWidget, children }: LabeledRowProps) => (
    <GtkListBoxRow selectable={false} activatable={activatable}>
        <GtkBox>
            <GtkLabel
                ref={labelRef}
                label={labelText}
                useUnderline={useUnderline}
                mnemonicWidget={mnemonicWidget ?? null}
                xalign={0}
                halign={Gtk.Align.START}
                valign={Gtk.Align.CENTER}
                hexpand
            />
            {children}
        </GtkBox>
    </GtkListBoxRow>
);

interface Group1ListProps {
    labelRef: Ref<Gtk.Label | null>;
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
    labelRef,
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
        <LabeledRow labelText="Switch" labelRef={labelRef} mnemonicWidget={switchRef.current}>
            <GtkSwitch
                name="switch"
                ref={switchRef}
                halign={Gtk.Align.END}
                valign={Gtk.Align.CENTER}
                active={switchActive}
                onStateSet={() => {
                    setSwitchActive((prev) => !prev);
                    return true;
                }}
            />
        </LabeledRow>
        <LabeledRow labelText="Check" labelRef={labelRef} mnemonicWidget={checkRef.current}>
            <GtkCheckButton
                name="check"
                ref={checkRef}
                halign={Gtk.Align.END}
                valign={Gtk.Align.CENTER}
                marginStart={10}
                marginEnd={10}
                active={checkActive}
                onToggled={() => setCheckActive((prev) => !prev)}
            />
        </LabeledRow>
        <LabeledRow labelText="Click here!" labelRef={labelRef} mnemonicWidget={imageRef.current}>
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
    </GtkListBox>
);

const Group2List = ({ labelRef }: { labelRef: Ref<Gtk.Label | null> }) => {
    const scaleAdjustment = useAdjustment({ value: 50, upper: 100, stepIncrement: 1, pageIncrement: 10 });
    const spinAdjustment = useAdjustment({ value: 50, upper: 100, stepIncrement: 1, pageIncrement: 10 });
    return (
        <GtkListBox name="group-2-list" selectionMode={Gtk.SelectionMode.NONE} cssClasses={["rich-list", "boxed-list"]}>
            <LabeledRow labelText="_Scale" labelRef={labelRef} useUnderline activatable={false}>
                <GtkScale
                    name="scale"
                    halign={Gtk.Align.END}
                    valign={Gtk.Align.CENTER}
                    drawValue={false}
                    widthRequest={150}
                    adjustment={scaleAdjustment}
                />
            </LabeledRow>
            <LabeledRow labelText="S_pinbutton" labelRef={labelRef} useUnderline activatable={false}>
                <GtkSpinButton
                    name="spin"
                    halign={Gtk.Align.END}
                    valign={Gtk.Align.CENTER}
                    adjustment={spinAdjustment}
                />
            </LabeledRow>
            <LabeledRow labelText="_Dropdown" labelRef={labelRef} useUnderline activatable={false}>
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
            </LabeledRow>
            <LabeledRow labelText="_Entry" labelRef={labelRef} useUnderline activatable={false}>
                <GtkEntry name="entry" halign={Gtk.Align.END} valign={Gtk.Align.CENTER} placeholderText="Type here…" />
            </LabeledRow>
        </GtkListBox>
    );
};

const ListBoxControlsDemo = () => {
    const [switchActive, setSwitchActive] = useState(false);
    const [checkActive, setCheckActive] = useState(true);
    const [imageOpacity, setImageOpacity] = useState(0);
    const [groupedLabels, setGroupedLabels] = useState<Gtk.Label[]>([]);

    const switchRef = useRef<Gtk.Switch | null>(null);
    const checkRef = useRef<Gtk.CheckButton | null>(null);
    const imageRef = useRef<Gtk.Image | null>(null);

    const collectLabel = useCallback((label: Gtk.Label | null) => {
        if (!label) return;
        setGroupedLabels((current) => [...current, label]);
        return () => {
            setGroupedLabels((current) => current.filter((grouped) => grouped !== label));
        };
    }, []);

    const handleRowActivated = (row: Gtk.ListBoxRow) => {
        const sw = switchRef.current;
        const chk = checkRef.current;
        const img = imageRef.current;
        if (sw?.isAncestor(row)) setSwitchActive((prev) => !prev);
        else if (chk?.isAncestor(row)) setCheckActive((prev) => !prev);
        else if (img?.isAncestor(row)) setImageOpacity((prev) => (prev === 0 ? 1 : 0));
    };

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
                    <GtkSizeGroup mode={Gtk.SizeGroupMode.HORIZONTAL} widgets={groupedLabels} />
                    <GtkLabel label="Group 1" xalign={0} marginBottom={10} cssClasses={["title-2"]} />
                    <Group1List
                        labelRef={collectLabel}
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
                    <Group2List labelRef={collectLabel} />
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
    windowTitle: "List Box — Controls",
};
