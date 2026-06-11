import * as Gtk from "@gtkx/gi/gtk";
import { AdwDialog, AdwHeaderBar, AdwToolbarView } from "@gtkx/jsx/adw";
import {
    GtkEntry,
    GtkGrid,
    GtkGridChild,
    GtkLabel,
    GtkScale,
    GtkShortcut,
    GtkShortcutController,
    GtkSwitch,
} from "@gtkx/jsx/gtk";
import { useAdjustment } from "@gtkx/react";
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
        <GtkGridChild column={0} row={0}>
            <GtkLabel
                label="_Details"
                useUnderline
                halign={Gtk.Align.END}
                valign={Gtk.Align.BASELINE}
                cssClasses={["dim-label"]}
                mnemonicWidget={detailsEntry}
            />
        </GtkGridChild>
        <GtkGridChild column={1} row={0} columnSpan={2}>
            <GtkEntry ref={setDetailsEntry} valign={Gtk.Align.BASELINE} onChanged={onChange} />
        </GtkGridChild>
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
        <GtkGridChild column={0} row={1}>
            <GtkLabel
                label="More D_etails"
                useUnderline
                halign={Gtk.Align.END}
                valign={Gtk.Align.BASELINE}
                cssClasses={["dim-label"]}
                mnemonicWidget={moreDetailsEntry}
            />
        </GtkGridChild>
        <GtkGridChild column={1} row={1} columnSpan={2}>
            <GtkEntry
                ref={setMoreDetailsEntry}
                valign={Gtk.Align.BASELINE}
                cssClasses={moreDetailsError ? ["error"] : []}
                tooltipText={moreDetailsError ? "Must have details first" : ""}
                accessibleInvalid={
                    moreDetailsError ? Gtk.AccessibleInvalidState.TRUE : Gtk.AccessibleInvalidState.FALSE
                }
                onChanged={onChange}
            />
        </GtkGridChild>
    </>
);

interface LevelScaleProps {
    levelScale: Gtk.Scale | null;
    setLevelScale: (s: Gtk.Scale | null) => void;
    onValueChanged: (value: number) => void;
}

const LevelScaleRow = ({ levelScale, setLevelScale, onValueChanged }: LevelScaleProps) => {
    const adjustment = useAdjustment({ value: 50, lower: 0, upper: 100, stepIncrement: 1, pageIncrement: 10 });
    return (
        <>
            <GtkGridChild column={0} row={2}>
                <GtkLabel
                    label="_Level"
                    useUnderline
                    halign={Gtk.Align.END}
                    valign={Gtk.Align.BASELINE}
                    cssClasses={["dim-label"]}
                    mnemonicWidget={levelScale}
                />
            </GtkGridChild>
            <GtkGridChild column={1} row={2} columnSpan={2}>
                <GtkScale
                    ref={setLevelScale}
                    orientation={Gtk.Orientation.HORIZONTAL}
                    valign={Gtk.Align.BASELINE}
                    drawValue={false}
                    adjustment={adjustment}
                    onValueChanged={(scale) => onValueChanged(scale.getValue())}
                />
            </GtkGridChild>
        </>
    );
};

interface ModeSwitchRowProps {
    state: ErrorStatesState;
    onStateSet: (state: boolean, sw: Gtk.Switch) => boolean;
}

const ModeSwitchRow = ({ state, onStateSet }: ModeSwitchRowProps) => {
    const { modeSwitch, setModeSwitch, showError, errorLabel, setErrorLabel } = state;
    return (
        <>
            <GtkGridChild column={0} row={3}>
                <GtkLabel
                    label="_Mode"
                    useUnderline
                    halign={Gtk.Align.END}
                    valign={Gtk.Align.BASELINE}
                    cssClasses={["dim-label"]}
                    mnemonicWidget={modeSwitch}
                />
            </GtkGridChild>
            <GtkGridChild column={1} row={3}>
                <GtkSwitch
                    ref={setModeSwitch}
                    halign={Gtk.Align.START}
                    valign={Gtk.Align.BASELINE}
                    accessibleKeyShortcuts="Control+M"
                    accessibleInvalid={showError ? Gtk.AccessibleInvalidState.TRUE : Gtk.AccessibleInvalidState.FALSE}
                    accessibleErrorMessage={showError && errorLabel ? [errorLabel] : undefined}
                    onStateSet={onStateSet}
                    addController={
                        <GtkShortcutController
                            scope={Gtk.ShortcutScope.MANAGED}
                            addShortcut={
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
            </GtkGridChild>
            <GtkGridChild column={2} row={3}>
                {showError && (
                    <GtkLabel
                        ref={setErrorLabel}
                        label="Level too low"
                        halign={Gtk.Align.START}
                        valign={Gtk.Align.BASELINE}
                        cssClasses={["error"]}
                    />
                )}
            </GtkGridChild>
        </>
    );
};

const ErrorstatesDemo = ({ onClose, window }: DemoProps) => {
    const state = useErrorStatesState();
    const handlers = useErrorStatesHandlers(state);

    return (
        <AdwDialog
            parent={window.current}
            title="Error States"
            canClose
            followsContentSize
            onClosed={() => onClose?.()}
        >
            <AdwToolbarView addTopBar={<AdwHeaderBar />}>
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
