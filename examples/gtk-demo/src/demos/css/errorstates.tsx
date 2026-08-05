import * as Gdk from "@gtkx/gi/gdk";
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
import { type ReactNode, useState } from "react";
import type { Demo, DemoProps } from "../types.js";
import sourceCode from "./errorstates.tsx?raw";

type ErrorStatesState = ReturnType<typeof useErrorStatesState>;

type ValidateDetailsArgs = {
    detailsEntry: Gtk.Entry | null;
    moreDetailsEntry: Gtk.Entry | null;
    setHasMoreDetailsError: (hasError: boolean) => void;
};

type LevelStateArgs = {
    modeSwitch: Gtk.Switch;
    value: number;
    setShowError: (hasError: boolean) => void;
};

type ModeStateArgs = {
    shouldEnable: boolean;
    sw: Gtk.Switch;
    levelScale: Gtk.Scale | null;
    setShowError: (hasError: boolean) => void;
};

type FieldLabelProps = {
    row: number;
    target: Gtk.Widget | null;
    children: ReactNode;
};

type EntryRowProps = {
    detailsEntry: Gtk.Entry | null;
    setDetailsEntry: (e: Gtk.Entry | null) => void;
    onChange: () => void;
};

type MoreDetailsRowProps = {
    moreDetailsEntry: Gtk.Entry | null;
    setMoreDetailsEntry: (e: Gtk.Entry | null) => void;
    hasMoreDetailsError: boolean;
    onChange: () => void;
};

type LevelScaleProps = {
    levelScale: Gtk.Scale | null;
    setLevelScale: (s: Gtk.Scale | null) => void;
    onValueChanged: (value: number) => void;
};

type ModeErrorLabelProps = {
    setErrorLabel: (l: Gtk.Label | null) => void;
};

type ModeSwitchRowProps = {
    state: ErrorStatesState;
    onStateSet: (shouldEnable: boolean, sw: Gtk.Switch) => boolean;
};

const errorstatesDemo: Demo = {
    id: "errorstates",
    title: "Error States",
    description:
        "GtkLabel and GtkEntry can indicate errors if you set the .error style class on them.\n\n" +
        "This examples shows how this can be used in a dialog for input validation.\n\n" +
        "It also shows how pass callbacks and objects to GtkBuilder with GtkBuilderScope and " +
        "gtk_builder_expose_object().",
    keywords: [],
    component: ErrorstatesDemo,
    sourceCode,
    isDialogOnly: true,
};

function useErrorStatesState() {
    const [showError, setShowError] = useState(false);
    const [hasMoreDetailsError, setHasMoreDetailsError] = useState(false);
    const [errorLabel, setErrorLabel] = useState<Gtk.Label | null>(null);
    const [detailsEntry, setDetailsEntry] = useState<Gtk.Entry | null>(null);
    const [moreDetailsEntry, setMoreDetailsEntry] = useState<Gtk.Entry | null>(null);
    const [levelScale, setLevelScale] = useState<Gtk.Scale | null>(null);
    const [modeSwitch, setModeSwitch] = useState<Gtk.Switch | null>(null);

    return {
        showError,
        setShowError,
        hasMoreDetailsError,
        setHasMoreDetailsError,
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

const validateMoreDetails = ({ detailsEntry, moreDetailsEntry, setHasMoreDetailsError }: ValidateDetailsArgs) => {
    const detailsText = detailsEntry?.getText() ?? "";
    const moreDetailsText = moreDetailsEntry?.getText() ?? "";
    setHasMoreDetailsError(moreDetailsText.length > 0 && detailsText.length === 0);
};

const syncModeStateForLevel = ({ modeSwitch, value, setShowError }: LevelStateArgs) => {
    const isActive = modeSwitch.getActive();
    const isSwitchState = modeSwitch.getState();

    if (isActive && !isSwitchState && value > 50) {
        setShowError(false);
        modeSwitch.setState(true);
    } else if (isSwitchState && value <= 50) {
        modeSwitch.setState(false);
    }
};

const applyModeState = ({ shouldEnable, sw, levelScale, setShowError }: ModeStateArgs) => {
    if (!shouldEnable || (levelScale && levelScale.getValue() > 50)) {
        setShowError(false);
        sw.setState(shouldEnable);
    } else {
        setShowError(true);
    }
};

function useErrorStatesHandlers(state: ErrorStatesState) {
    const { detailsEntry, moreDetailsEntry, modeSwitch, levelScale, setHasMoreDetailsError, setShowError } = state;

    const handleDetailsChange = () => {
        validateMoreDetails({ detailsEntry, moreDetailsEntry, setHasMoreDetailsError });
    };

    const handleMoreDetailsChange = () => {
        validateMoreDetails({ detailsEntry, moreDetailsEntry, setHasMoreDetailsError });
    };

    const handleLevelChange = (value: number) => {
        if (!modeSwitch || !levelScale) {
            return;
        }

        syncModeStateForLevel({ modeSwitch, value, setShowError });
    };

    const handleModeStateSet = (shouldEnable: boolean, sw: Gtk.Switch) => {
        applyModeState({ shouldEnable, sw, levelScale, setShowError });

        return Gdk.EVENT_STOP;
    };

    return { handleDetailsChange, handleMoreDetailsChange, handleLevelChange, handleModeStateSet };
}

const FieldLabel = ({ row, target, children }: FieldLabelProps) => (
    <GtkGridLayoutChild column={0} row={row}>
        <GtkLabel
            useUnderline
            halign={Gtk.Align.END}
            valign={Gtk.Align.BASELINE_FILL}
            cssClasses={["dim-label"]}
            mnemonicWidget={target}
        >
            {children}
        </GtkLabel>
    </GtkGridLayoutChild>
);

const DetailsEntryRow = ({ detailsEntry, setDetailsEntry, onChange }: EntryRowProps) => (
    <>
        <FieldLabel row={0} target={detailsEntry}>
            _Details
        </FieldLabel>
        <GtkGridLayoutChild column={1} row={0} columnSpan={2}>
            <GtkEntry
                ref={(node) => {
                    setDetailsEntry(node);
                }}
                valign={Gtk.Align.BASELINE_FILL}
                onChanged={onChange}
            />
        </GtkGridLayoutChild>
    </>
);

const MoreDetailsEntryRow = ({
    moreDetailsEntry,
    setMoreDetailsEntry,
    hasMoreDetailsError,
    onChange,
}: MoreDetailsRowProps) => (
    <>
        <FieldLabel row={1} target={moreDetailsEntry}>
            More D_etails
        </FieldLabel>
        <GtkGridLayoutChild column={1} row={1} columnSpan={2}>
            <GtkEntry
                ref={(node) => {
                    setMoreDetailsEntry(node);
                }}
                valign={Gtk.Align.BASELINE_FILL}
                cssClasses={hasMoreDetailsError ? ["error"] : []}
                tooltipText={hasMoreDetailsError ? "Must have details first" : ""}
                accessibleInvalid={
                    hasMoreDetailsError ? Gtk.AccessibleInvalidState.TRUE : Gtk.AccessibleInvalidState.FALSE
                }
                onChanged={onChange}
            />
        </GtkGridLayoutChild>
    </>
);

const LevelScaleRow = ({ levelScale, setLevelScale, onValueChanged }: LevelScaleProps) => (
    <>
        <FieldLabel row={2} target={levelScale}>
            _Level
        </FieldLabel>
        <GtkGridLayoutChild column={1} row={2} columnSpan={2}>
            <GtkScale
                ref={(node) => {
                    setLevelScale(node);
                }}
                orientation={Gtk.Orientation.HORIZONTAL}
                valign={Gtk.Align.BASELINE_FILL}
                drawValue={false}
                adjustment={<GtkAdjustment value={50} lower={0} upper={100} stepIncrement={1} pageIncrement={10} />}
                onValueChanged={(scale) => {
                    onValueChanged(scale.getValue());
                }}
            />
        </GtkGridLayoutChild>
    </>
);

const ModeErrorLabel = ({ setErrorLabel }: ModeErrorLabelProps) => (
    <GtkGridLayoutChild column={2} row={3}>
        <GtkLabel
            ref={(node) => {
                setErrorLabel(node);
            }}
            halign={Gtk.Align.START}
            valign={Gtk.Align.BASELINE_FILL}
            cssClasses={["error"]}
        >
            Level too low
        </GtkLabel>
    </GtkGridLayoutChild>
);

const ModeSwitchRow = ({ state, onStateSet }: ModeSwitchRowProps) => {
    const { modeSwitch, setModeSwitch, showError, errorLabel, setErrorLabel } = state;

    return (
        <>
            <FieldLabel row={3} target={modeSwitch}>
                _Mode
            </FieldLabel>
            <GtkGridLayoutChild column={1} row={3}>
                <GtkSwitch
                    ref={(node) => {
                        setModeSwitch(node);
                    }}
                    halign={Gtk.Align.START}
                    valign={Gtk.Align.BASELINE_FILL}
                    accessibleKeyShortcuts="Control+M"
                    accessibleInvalid={showError ? Gtk.AccessibleInvalidState.TRUE : Gtk.AccessibleInvalidState.FALSE}
                    accessibleErrorMessage={showError && errorLabel ? [errorLabel] : undefined}
                    onStateSet={onStateSet}
                    controllers={(
                        <GtkShortcutController
                            scope={Gtk.ShortcutScope.MANAGED}
                            shortcuts={(
                                <GtkShortcut
                                    trigger={Gtk.ShortcutTrigger.parseString("<Control>m")}
                                    action={Gtk.CallbackAction.new(() => {
                                        modeSwitch?.activate();

                                        return true;
                                    })}
                                />
                            )}
                        />
                    )}
                />
            </GtkGridLayoutChild>
            {showError && <ModeErrorLabel setErrorLabel={setErrorLabel} />}
        </>
    );
};

function ErrorstatesDemo({ onClose }: DemoProps) {
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
                        hasMoreDetailsError={state.hasMoreDetailsError}
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
}

export { errorstatesDemo };
