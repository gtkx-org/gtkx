import { Grid } from "@gtkx/components";
import { Dialog } from "@gtkx/components/adw";
import * as Gtk from "@gtkx/gi/gtk";
import { AdwDialog, AdwHeaderBar, AdwToolbarView } from "@gtkx/jsx/adw";
import {
    GtkAdjustment,
    GtkEntry,
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
        <Grid.Child column={0} row={0}>
            {(ref) => (
                <GtkLabel
                    ref={ref}
                    label="_Details"
                    useUnderline
                    halign={Gtk.Align.END}
                    valign={Gtk.Align.BASELINE}
                    cssClasses={["dim-label"]}
                    mnemonicWidget={detailsEntry}
                />
            )}
        </Grid.Child>
        <Grid.Child column={1} row={0} columnSpan={2}>
            {(ref) => (
                <GtkEntry
                    ref={(node) => {
                        ref(node);
                        setDetailsEntry(node);
                    }}
                    valign={Gtk.Align.BASELINE}
                    onChanged={onChange}
                />
            )}
        </Grid.Child>
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
        <Grid.Child column={0} row={1}>
            {(ref) => (
                <GtkLabel
                    ref={ref}
                    label="More D_etails"
                    useUnderline
                    halign={Gtk.Align.END}
                    valign={Gtk.Align.BASELINE}
                    cssClasses={["dim-label"]}
                    mnemonicWidget={moreDetailsEntry}
                />
            )}
        </Grid.Child>
        <Grid.Child column={1} row={1} columnSpan={2}>
            {(ref) => (
                <GtkEntry
                    ref={(node) => {
                        ref(node);
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
            )}
        </Grid.Child>
    </>
);

interface LevelScaleProps {
    levelScale: Gtk.Scale | null;
    setLevelScale: (s: Gtk.Scale | null) => void;
    onValueChanged: (value: number) => void;
}

const LevelScaleRow = ({ levelScale, setLevelScale, onValueChanged }: LevelScaleProps) => (
    <>
        <Grid.Child column={0} row={2}>
            {(ref) => (
                <GtkLabel
                    ref={ref}
                    label="_Level"
                    useUnderline
                    halign={Gtk.Align.END}
                    valign={Gtk.Align.BASELINE}
                    cssClasses={["dim-label"]}
                    mnemonicWidget={levelScale}
                />
            )}
        </Grid.Child>
        <Grid.Child column={1} row={2} columnSpan={2}>
            {(ref) => (
                <GtkScale
                    ref={(node) => {
                        ref(node);
                        setLevelScale(node);
                    }}
                    orientation={Gtk.Orientation.HORIZONTAL}
                    valign={Gtk.Align.BASELINE}
                    drawValue={false}
                    adjustment={<GtkAdjustment value={50} lower={0} upper={100} stepIncrement={1} pageIncrement={10} />}
                    onValueChanged={(scale) => onValueChanged(scale.getValue())}
                />
            )}
        </Grid.Child>
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
            <Grid.Child column={0} row={3}>
                {(ref) => (
                    <GtkLabel
                        ref={ref}
                        label="_Mode"
                        useUnderline
                        halign={Gtk.Align.END}
                        valign={Gtk.Align.BASELINE}
                        cssClasses={["dim-label"]}
                        mnemonicWidget={modeSwitch}
                    />
                )}
            </Grid.Child>
            <Grid.Child column={1} row={3}>
                {(ref) => (
                    <GtkSwitch
                        ref={(node) => {
                            ref(node);
                            setModeSwitch(node);
                        }}
                        halign={Gtk.Align.START}
                        valign={Gtk.Align.BASELINE}
                        accessibleKeyShortcuts="Control+M"
                        accessibleInvalid={
                            showError ? Gtk.AccessibleInvalidState.TRUE : Gtk.AccessibleInvalidState.FALSE
                        }
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
                )}
            </Grid.Child>
            <Grid.Child column={2} row={3}>
                {(ref) =>
                    showError && (
                        <GtkLabel
                            ref={(node) => {
                                ref(node);
                                setErrorLabel(node);
                            }}
                            label="Level too low"
                            halign={Gtk.Align.START}
                            valign={Gtk.Align.BASELINE}
                            cssClasses={["error"]}
                        />
                    )
                }
            </Grid.Child>
        </>
    );
};

const ErrorstatesDemo = ({ onClose, window }: DemoProps) => {
    const state = useErrorStatesState();
    const handlers = useErrorStatesHandlers(state);

    return (
        <Dialog parent={window.current}>
            <AdwDialog title="Error States" canClose followsContentSize onClosed={() => onClose?.()}>
                <AdwToolbarView topBar={<AdwHeaderBar />}>
                    <Grid
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
                    </Grid>
                </AdwToolbarView>
            </AdwDialog>
        </Dialog>
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
