import * as Gtk from "@gtkx/gi/gtk";
import { AdwDialog, AdwHeaderBar, AdwToolbarView } from "@gtkx/jsx/adw";
import {
    GtkAdjustment,
    GtkEntry,
    GtkGrid,
    GtkGridLayoutChild,
    GtkLabel,
    GtkScale,
    GtkShortcut,
    GtkShortcutController,
    GtkSwitch,
} from "@gtkx/jsx/gtk";
import { useState } from "react";
import type { Demo, DemoProps } from "../types.js";
import sourceCode from "./errorstates.tsx?raw";

function useErrorStatesState() {
    const [showError, setShowError] = useState(false);
    const [moreDetailsError, setMoreDetailsError] = useState(false);
    const [errorLabel, setErrorLabel] = useState<Gtk.Label | null>(null);
    const [detailsEntry, setDetailsEntry] = useState<Gtk.Entry | null>(null);
    const [moreDetailsEntry, setMoreDetailsEntry] = useState<Gtk.Entry | null>(null);
    const [levelScale, setLevelScale] = useState<Gtk.Scale | null>(null);
    const [modeSwitch, setModeSwitch] = useState<Gtk.Switch | null>(null);

    return {
        showError,
        setShowError,
        moreDetailsError,
        setMoreDetailsError,
        errorLabel,
        setErrorLabel,
        detailsEntry,
        setDetailsEntry,
        moreDetailsEntry,
        setMoreDetailsEntry,
        levelScale,
        setLevelScale,
        modeSwitch,
        setModeSwitch,
    };
}

type ErrorStatesState = ReturnType<typeof useErrorStatesState>;

function useErrorStatesHandlers(state: ErrorStatesState) {
    const { detailsEntry, moreDetailsEntry, modeSwitch, levelScale, setMoreDetailsError, setShowError } = state;

    const validateMoreDetails = () => {
        const detailsText = detailsEntry?.getText() ?? "";
        const moreDetailsText = moreDetailsEntry?.getText() ?? "";
        setMoreDetailsError(moreDetailsText.length > 0 && detailsText.length === 0);
    };

    const handleDetailsChange = () => validateMoreDetails();
    const handleMoreDetailsChange = () => validateMoreDetails();

    const handleLevelChange = (_value: number) => {
        if (!modeSwitch || !levelScale) return;
        const active = modeSwitch.getActive();
        const switchState = modeSwitch.getState();
        const value = levelScale.getValue();
        if (active && !switchState && value > 50) {
            setShowError(false);
            modeSwitch.setState(true);
        } else if (switchState && value <= 50) {
            modeSwitch.setState(false);
        }
    };

    const handleModeStateSet = (switchState: boolean, sw: Gtk.Switch) => {
        if (!switchState || (levelScale && levelScale.getValue() > 50)) {
            setShowError(false);
            sw.setState(switchState);
        } else {
            setShowError(true);
        }
        return true;
    };

    return { handleDetailsChange, handleMoreDetailsChange, handleLevelChange, handleModeStateSet };
}

interface EntryRowProps {
    detailsEntry: Gtk.Entry | null;
    setDetailsEntry: (e: Gtk.Entry | null) => void;
    onChange: () => void;
}

const DetailsEntryRow = ({ detailsEntry, setDetailsEntry, onChange }: EntryRowProps) => (
    <>
        <GtkGridLayoutChild column={0} row={0}>
            <GtkLabel
                useUnderline
                halign={Gtk.Align.END}
                valign={Gtk.Align.BASELINE}
                cssClasses={["dim-label"]}
                mnemonicWidget={detailsEntry}
            >
                _Details
            </GtkLabel>
        </GtkGridLayoutChild>
        <GtkGridLayoutChild column={1} row={0} columnSpan={2}>
            <GtkEntry
                ref={(node) => {
                    setDetailsEntry(node);
                }}
                valign={Gtk.Align.BASELINE}
                onChanged={onChange}
            />
        </GtkGridLayoutChild>
    </>
);

interface MoreDetailsRowProps {
    moreDetailsEntry: Gtk.Entry | null;
    setMoreDetailsEntry: (e: Gtk.Entry | null) => void;
    moreDetailsError: boolean;
    onChange: () => void;
}

const MoreDetailsEntryRow = ({
    moreDetailsEntry,
    setMoreDetailsEntry,
    moreDetailsError,
    onChange,
}: MoreDetailsRowProps) => (
    <>
        <GtkGridLayoutChild column={0} row={1}>
            <GtkLabel
                useUnderline
                halign={Gtk.Align.END}
                valign={Gtk.Align.BASELINE}
                cssClasses={["dim-label"]}
                mnemonicWidget={moreDetailsEntry}
            >
                More D_etails
            </GtkLabel>
        </GtkGridLayoutChild>
        <GtkGridLayoutChild column={1} row={1} columnSpan={2}>
            <GtkEntry
                ref={(node) => {
                    setMoreDetailsEntry(node);
                }}
                valign={Gtk.Align.BASELINE}
                cssClasses={moreDetailsError ? ["error"] : []}
                tooltipText={moreDetailsError ? "Must have details first" : ""}
                accessibleInvalid={
                    moreDetailsError ? Gtk.AccessibleInvalidState.TRUE : Gtk.AccessibleInvalidState.FALSE
                }
                onChanged={onChange}
            />
        </GtkGridLayoutChild>
    </>
);

interface LevelScaleProps {
    levelScale: Gtk.Scale | null;
    setLevelScale: (s: Gtk.Scale | null) => void;
    onValueChanged: (value: number) => void;
}

const LevelScaleRow = ({ levelScale, setLevelScale, onValueChanged }: LevelScaleProps) => (
    <>
        <GtkGridLayoutChild column={0} row={2}>
            <GtkLabel
                useUnderline
                halign={Gtk.Align.END}
                valign={Gtk.Align.BASELINE}
                cssClasses={["dim-label"]}
                mnemonicWidget={levelScale}
            >
                _Level
            </GtkLabel>
        </GtkGridLayoutChild>
        <GtkGridLayoutChild column={1} row={2} columnSpan={2}>
            <GtkScale
                ref={(node) => {
                    setLevelScale(node);
                }}
                orientation={Gtk.Orientation.HORIZONTAL}
                valign={Gtk.Align.BASELINE}
                drawValue={false}
                adjustment={<GtkAdjustment value={50} lower={0} upper={100} stepIncrement={1} pageIncrement={10} />}
                onValueChanged={(scale) => onValueChanged(scale.getValue())}
            />
        </GtkGridLayoutChild>
    </>
);

interface ModeSwitchRowProps {
    state: ErrorStatesState;
    onStateSet: (state: boolean, sw: Gtk.Switch) => boolean;
}

const ModeSwitchRow = ({ state, onStateSet }: ModeSwitchRowProps) => {
    const { modeSwitch, setModeSwitch, showError, errorLabel, setErrorLabel } = state;
    return (
        <>
            <GtkGridLayoutChild column={0} row={3}>
                <GtkLabel
                    useUnderline
                    halign={Gtk.Align.END}
                    valign={Gtk.Align.BASELINE}
                    cssClasses={["dim-label"]}
                    mnemonicWidget={modeSwitch}
                >
                    _Mode
                </GtkLabel>
            </GtkGridLayoutChild>
            <GtkGridLayoutChild column={1} row={3}>
                <GtkSwitch
                    ref={(node) => {
                        setModeSwitch(node);
                    }}
                    halign={Gtk.Align.START}
                    valign={Gtk.Align.BASELINE}
                    accessibleKeyShortcuts="Control+M"
                    accessibleInvalid={showError ? Gtk.AccessibleInvalidState.TRUE : Gtk.AccessibleInvalidState.FALSE}
                    accessibleErrorMessage={showError && errorLabel ? [errorLabel] : undefined}
                    onStateSet={onStateSet}
                    controllers={
                        <GtkShortcutController
                            scope={Gtk.ShortcutScope.MANAGED}
                            shortcuts={
                                <GtkShortcut
                                    trigger={Gtk.ShortcutTrigger.parseString("<Control>m")}
                                    action={Gtk.CallbackAction.new(() => {
                                        modeSwitch?.activate();
                                        return true;
                                    })}
                                />
                            }
                        />
                    }
                />
            </GtkGridLayoutChild>
            {showError && (
                <GtkGridLayoutChild column={2} row={3}>
                    <GtkLabel
                        ref={(node) => {
                            setErrorLabel(node);
                        }}
                        halign={Gtk.Align.START}
                        valign={Gtk.Align.BASELINE}
                        cssClasses={["error"]}
                    >
                        Level too low
                    </GtkLabel>
                </GtkGridLayoutChild>
            )}
        </>
    );
};

const ErrorstatesDemo = ({ onClose }: DemoProps) => {
    const state = useErrorStatesState();
    const handlers = useErrorStatesHandlers(state);

    return (
        <AdwDialog onClosed={() => onClose?.()} title="Error States" canClose followsContentSize>
            <AdwToolbarView topBar={<AdwHeaderBar />}>
                <GtkGrid
                    rowSpacing={10}
                    columnSpacing={10}
                    marginStart={20}
                    marginEnd={20}
                    marginTop={20}
                    marginBottom={20}
                >
                    <DetailsEntryRow
                        detailsEntry={state.detailsEntry}
                        setDetailsEntry={state.setDetailsEntry}
                        onChange={handlers.handleDetailsChange}
                    />
                    <MoreDetailsEntryRow
                        moreDetailsEntry={state.moreDetailsEntry}
                        setMoreDetailsEntry={state.setMoreDetailsEntry}
                        moreDetailsError={state.moreDetailsError}
                        onChange={handlers.handleMoreDetailsChange}
                    />
                    <LevelScaleRow
                        levelScale={state.levelScale}
                        setLevelScale={state.setLevelScale}
                        onValueChanged={handlers.handleLevelChange}
                    />
                    <ModeSwitchRow state={state} onStateSet={handlers.handleModeStateSet} />
                </GtkGrid>
            </AdwToolbarView>
        </AdwDialog>
    );
};

export const errorstatesDemo: Demo = {
    id: "errorstates",
    title: "Error States",
    description:
        "GtkLabel and GtkEntry can indicate errors if you set the .error style class on them.\n\nThis examples shows how this can be used in a dialog for input validation.\n\nIt also shows how pass callbacks and objects to GtkBuilder with GtkBuilderScope and gtk_builder_expose_object().",
    keywords: [],
    component: ErrorstatesDemo,
    sourceCode,
    dialogOnly: true,
};
