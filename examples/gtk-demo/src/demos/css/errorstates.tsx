import * as Gtk from "@gtkx/gi/gtk";
import {
    AdwDialog,
    AdwHeaderBar,
    AdwToolbarView,
    GtkEntry,
    GtkGrid,
    GtkLabel,
    GtkScale,
    GtkShortcutController,
    GtkSwitch,
} from "@gtkx/react";
import { useCallback, useState } from "react";
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

    const validateMoreDetails = useCallback(() => {
        const detailsText = detailsEntry?.getText() ?? "";
        const moreDetailsText = moreDetailsEntry?.getText() ?? "";
        setMoreDetailsError(moreDetailsText.length > 0 && detailsText.length === 0);
    }, [detailsEntry, moreDetailsEntry, setMoreDetailsError]);

    const handleDetailsChange = useCallback(() => validateMoreDetails(), [validateMoreDetails]);
    const handleMoreDetailsChange = useCallback(() => validateMoreDetails(), [validateMoreDetails]);

    const handleLevelChange = useCallback(
        (_value: number) => {
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
        },
        [modeSwitch, levelScale, setShowError],
    );

    const handleModeStateSet = useCallback(
        (switchState: boolean, sw: Gtk.Switch) => {
            if (!switchState || (levelScale && levelScale.getValue() > 50)) {
                setShowError(false);
                sw.setState(switchState);
            } else {
                setShowError(true);
            }
            return true;
        },
        [levelScale, setShowError],
    );

    return { handleDetailsChange, handleMoreDetailsChange, handleLevelChange, handleModeStateSet };
}

interface EntryRowProps {
    detailsEntry: Gtk.Entry | null;
    setDetailsEntry: (e: Gtk.Entry | null) => void;
    onChange: () => void;
}

const DetailsEntryRow = ({ detailsEntry, setDetailsEntry, onChange }: EntryRowProps) => (
    <>
        <GtkGrid.Child column={0} row={0}>
            <GtkLabel
                label="_Details"
                useUnderline
                halign={Gtk.Align.END}
                valign={Gtk.Align.BASELINE}
                cssClasses={["dim-label"]}
                mnemonicWidget={detailsEntry}
            />
        </GtkGrid.Child>
        <GtkGrid.Child column={1} row={0} columnSpan={2}>
            <GtkEntry ref={setDetailsEntry} valign={Gtk.Align.BASELINE} onChanged={onChange} />
        </GtkGrid.Child>
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
        <GtkGrid.Child column={0} row={1}>
            <GtkLabel
                label="More D_etails"
                useUnderline
                halign={Gtk.Align.END}
                valign={Gtk.Align.BASELINE}
                cssClasses={["dim-label"]}
                mnemonicWidget={moreDetailsEntry}
            />
        </GtkGrid.Child>
        <GtkGrid.Child column={1} row={1} columnSpan={2}>
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
        </GtkGrid.Child>
    </>
);

interface LevelScaleProps {
    levelScale: Gtk.Scale | null;
    setLevelScale: (s: Gtk.Scale | null) => void;
    onValueChanged: (value: number) => void;
}

const LevelScaleRow = ({ levelScale, setLevelScale, onValueChanged }: LevelScaleProps) => (
    <>
        <GtkGrid.Child column={0} row={2}>
            <GtkLabel
                label="_Level"
                useUnderline
                halign={Gtk.Align.END}
                valign={Gtk.Align.BASELINE}
                cssClasses={["dim-label"]}
                mnemonicWidget={levelScale}
            />
        </GtkGrid.Child>
        <GtkGrid.Child column={1} row={2} columnSpan={2}>
            <GtkScale
                ref={setLevelScale}
                orientation={Gtk.Orientation.HORIZONTAL}
                valign={Gtk.Align.BASELINE}
                drawValue={false}
                value={50}
                lower={0}
                upper={100}
                stepIncrement={1}
                pageIncrement={10}
                onValueChanged={onValueChanged}
            />
        </GtkGrid.Child>
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
            <GtkGrid.Child column={0} row={3}>
                <GtkLabel
                    label="_Mode"
                    useUnderline
                    halign={Gtk.Align.END}
                    valign={Gtk.Align.BASELINE}
                    cssClasses={["dim-label"]}
                    mnemonicWidget={modeSwitch}
                />
            </GtkGrid.Child>
            <GtkGrid.Child column={1} row={3}>
                <GtkSwitch
                    ref={setModeSwitch}
                    halign={Gtk.Align.START}
                    valign={Gtk.Align.BASELINE}
                    accessibleKeyShortcuts="Control+M"
                    accessibleInvalid={showError ? Gtk.AccessibleInvalidState.TRUE : Gtk.AccessibleInvalidState.FALSE}
                    accessibleErrorMessage={showError && errorLabel ? [errorLabel] : undefined}
                    onStateSet={onStateSet}
                >
                    <GtkShortcutController scope={Gtk.ShortcutScope.MANAGED}>
                        <GtkShortcutController.Shortcut
                            trigger="<Control>m"
                            onActivate={() => modeSwitch?.activate()}
                        />
                    </GtkShortcutController>
                </GtkSwitch>
            </GtkGrid.Child>
            <GtkGrid.Child column={2} row={3}>
                {showError && (
                    <GtkLabel
                        ref={setErrorLabel}
                        label="Level too low"
                        halign={Gtk.Align.START}
                        valign={Gtk.Align.BASELINE}
                        cssClasses={["error"]}
                    />
                )}
            </GtkGrid.Child>
        </>
    );
};

const ErrorstatesDemo = ({ onClose }: DemoProps) => {
    const state = useErrorStatesState();
    const handlers = useErrorStatesHandlers(state);

    return (
        <AdwDialog title="Error States" canClose followsContentSize onClosed={() => onClose?.()}>
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
