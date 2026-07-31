import { DropDown } from "@gtkx/components";
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
    GtkSizeGroup,
    GtkSpinButton,
    GtkSwitch,
    GtkViewport,
} from "@gtkx/jsx/gtk";
import {
    type Dispatch,
    type ReactNode,
    type RefCallback,
    type SetStateAction,
    useMemo,
    useRef,
    useState,
} from "react";
import type { Demo } from "../types.js";
import sourceCode from "./listbox-controls.tsx?raw";

type LabelRef = RefCallback<Gtk.Widget | null>;

type LabeledRowProps = {
    labelText: string;
    labelRef: LabelRef;
    useUnderline?: boolean;
    activatable?: boolean;
    children: ReactNode;
};

type SwitchRowProps = {
    labelRef: LabelRef;
    switchRef: React.RefObject<Gtk.Switch | null>;
    switchActive: boolean;
    setSwitchActive: Dispatch<SetStateAction<boolean>>;
};

type CheckRowProps = {
    labelRef: LabelRef;
    checkRef: React.RefObject<Gtk.CheckButton | null>;
    checkActive: boolean;
    setCheckActive: Dispatch<SetStateAction<boolean>>;
};

type ClickHereRowProps = {
    labelRef: LabelRef;
    imageRef: React.RefObject<Gtk.Image | null>;
    imageOpacity: number;
};

type RowToggles = {
    switchRef: React.RefObject<Gtk.Switch | null>;
    checkRef: React.RefObject<Gtk.CheckButton | null>;
    imageRef: React.RefObject<Gtk.Image | null>;
    setSwitchActive: Dispatch<SetStateAction<boolean>>;
    setCheckActive: Dispatch<SetStateAction<boolean>>;
    setImageOpacity: Dispatch<SetStateAction<number>>;
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

const withoutLabel = (labels: Gtk.Widget[], label: Gtk.Widget): Gtk.Widget[] =>
    labels.filter((entry) => entry !== label);

function collectLabel(setLabels: Dispatch<SetStateAction<Gtk.Widget[]>>): LabelRef {
    return (label) => {
        if (label === null) {
            return;
        }

        setLabels((previous) => [...previous, label]);

        return () => {
            setLabels((previous) => withoutLabel(previous, label));
        };
    };
}

const LabeledRow = ({ labelText, labelRef, useUnderline, activatable, children }: LabeledRowProps) => (
    <GtkListBoxRow selectable={false} activatable={activatable}>
        <GtkBox>
            <GtkLabel
                ref={labelRef}
                useUnderline={useUnderline}
                xalign={0}
                halign={Gtk.Align.START}
                valign={Gtk.Align.CENTER}
                hexpand
            >
                {labelText}
            </GtkLabel>
            {children}
        </GtkBox>
    </GtkListBoxRow>
);

const SwitchRow = ({ labelRef, switchRef, switchActive, setSwitchActive }: SwitchRowProps) => (
    <LabeledRow labelText="Switch" labelRef={labelRef}>
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

const CheckRow = ({ labelRef, checkRef, checkActive, setCheckActive }: CheckRowProps) => (
    <LabeledRow labelText="Check" labelRef={labelRef}>
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

const ClickHereRow = ({ labelRef, imageRef, imageOpacity }: ClickHereRowProps) => (
    <LabeledRow labelText="Click here!" labelRef={labelRef}>
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

function Group1List({ labelRef }: { labelRef: LabelRef }) {
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
            <SwitchRow
                labelRef={labelRef}
                switchRef={switchRef}
                switchActive={switchActive}
                setSwitchActive={setSwitchActive}
            />
            <CheckRow
                labelRef={labelRef}
                checkRef={checkRef}
                checkActive={checkActive}
                setCheckActive={setCheckActive}
            />
            <ClickHereRow labelRef={labelRef} imageRef={imageRef} imageOpacity={imageOpacity} />
        </GtkListBox>
    );
}

const valueAdjustment = () => <GtkAdjustment value={50} upper={100} stepIncrement={1} pageIncrement={10} />;

const Group2List = ({ labelRef }: { labelRef: LabelRef }) => {
    return (
        <GtkListBox name="group-2-list" selectionMode={Gtk.SelectionMode.NONE} cssClasses={["rich-list", "boxed-list"]}>
            <LabeledRow labelText="_Scale" labelRef={labelRef} useUnderline activatable={false}>
                <GtkScale
                    name="scale"
                    halign={Gtk.Align.END}
                    valign={Gtk.Align.CENTER}
                    drawValue={false}
                    widthRequest={150}
                    adjustment={valueAdjustment()}
                />
            </LabeledRow>
            <LabeledRow labelText="S_pinbutton" labelRef={labelRef} useUnderline activatable={false}>
                <GtkSpinButton
                    name="spin"
                    halign={Gtk.Align.END}
                    valign={Gtk.Align.CENTER}
                    adjustment={valueAdjustment()}
                />
            </LabeledRow>
            <LabeledRow labelText="_Dropdown" labelRef={labelRef} useUnderline activatable={false}>
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
            <LabeledRow labelText="_Entry" labelRef={labelRef} useUnderline activatable={false}>
                <GtkEntry name="entry" halign={Gtk.Align.END} valign={Gtk.Align.CENTER} placeholderText="Type here…" />
            </LabeledRow>
        </GtkListBox>
    );
};

function ListBoxControlsDemo() {
    const [labels, setLabels] = useState<Gtk.Widget[]>([]);
    const labelRef = useMemo(() => collectLabel(setLabels), [setLabels]);

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
                    <GtkSizeGroup mode={Gtk.SizeGroupMode.HORIZONTAL} widgets={labels} />
                    <GtkLabel xalign={0} marginBottom={10} cssClasses={["title-2"]}>
                        Group 1
                    </GtkLabel>
                    <Group1List labelRef={labelRef} />

                    <GtkLabel xalign={0} marginTop={30} marginBottom={10} cssClasses={["title-2"]}>
                        Group 2
                    </GtkLabel>
                    <Group2List labelRef={labelRef} />
                </GtkBox>
            </GtkViewport>
        </GtkScrolledWindow>
    );
}

export { listboxControlsDemo };
