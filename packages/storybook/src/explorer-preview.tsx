import type { ReactNode } from "react";
import * as Gtk from "@gtkx/gi/gtk";
import { AdwHeaderBar, AdwStatusPage, AdwToolbarView, AdwWindowTitle } from "@gtkx/jsx/adw";
import { GtkBox, GtkButton, GtkScrolledWindow } from "@gtkx/jsx/gtk";
import { createPortal, rootElement } from "@gtkx/react";
import { Component, useCallback, useMemo, useState } from "react";
import type { StoryEntry } from "./catalog.js";
import type { Args, ComposedStory } from "./types.js";
import { ActionsPanel } from "./actions-panel.js";
import { ActionStore, bindActions } from "./actions.js";
import { Controls } from "./controls.js";

type PreviewProps = {
    entry: StoryEntry;
};

type PreviewState = {
    story: ComposedStory;
    args: Args;
    generation: number;
    error: Error | null;
    actions: ActionStore;
};

type BoundaryProps = { children: ReactNode; args: Args };
type BoundaryState = { error: Error | null; args: Args };

class PreviewBoundary extends Component<BoundaryProps, BoundaryState> {
    static getDerivedStateFromProps(props: BoundaryProps, state: BoundaryState): BoundaryState | null {
        return props.args === state.args ? null : { error: null, args: props.args };
    }

    static getDerivedStateFromError(error: unknown): Pick<BoundaryState, "error"> {
        return { error: error instanceof Error ? error : new Error(String(error)) };
    }

    override state: BoundaryState = { error: null, args: this.props.args };

    override render(): ReactNode {
        return this.state.error === null
            ? this.props.children
            : (
                    <AdwStatusPage
                        name="storybook-preview-error"
                        title="Preview failed"
                        iconName="dialog-error-symbolic"
                        description="Adjust controls, reset the preview, or select another story to continue."
                    />
                );
    }
}

const previewMode = (story: ComposedStory): "content" | "window" | "dialog" => {
    const gtkx = story.parameters.gtkx;
    const mode = typeof gtkx === "object" && gtkx !== null && "preview" in gtkx ? gtkx.preview : "content";

    if (mode !== "content" && mode !== "window" && mode !== "dialog") {
        throw new Error("Unsupported GTKX story preview mode");
    }

    return mode;
};

const PreviewContent = ({ story: Story, args }: { story: ComposedStory; args: Args }): ReactNode => {
    const mode = previewMode(Story);

    if (mode !== "content") {
        return (
            <>
                <AdwStatusPage
                    title={mode === "window" ? "Window preview" : "Dialog preview"}
                    iconName="window-new-symbolic"
                    description="The story owns its presentation. Reset to open it again."
                />
                {createPortal(<Story {...args} />, rootElement)}
            </>
        );
    }

    const margin = Story.parameters.layout === "fullscreen" ? 0 : 24;
    const align = Story.parameters.layout === "centered" ? Gtk.Align.CENTER : Gtk.Align.FILL;

    return (
        <GtkBox
            name="storybook-canvas"
            orientation={Gtk.Orientation.VERTICAL}
            hexpand
            vexpand
            halign={align}
            valign={align}
            marginTop={margin}
            marginBottom={margin}
            marginStart={margin}
            marginEnd={margin}
        >
            <Story {...args} />
        </GtkBox>
    );
};

const usePreviewState = ({ entry }: PreviewProps) => {
    const [state, setState] = useState<PreviewState>(() => ({
        story: entry.story,
        args: { ...entry.story.args },
        generation: 0,
        error: null,
        actions: new ActionStore(),
    }));
    const onError = useCallback((error: Error) => {
        setState((current) => current.story === state.story && current.generation === state.generation
            ? { ...current, error }
            : current);
    }, [state.story, state.generation]);
    const boundArgs = useMemo(
        () => bindActions(state.args, state.story.argTypes, state.actions, onError),
        [state.args, state.story.argTypes, state.actions, onError],
    );

    if (state.story !== entry.story) {
        setState({
            story: entry.story,
            args: { ...entry.story.args },
            generation: state.generation + 1,
            error: null,
            actions: new ActionStore(),
        });
    }

    const reset = (): void => {
        setState((current) => ({
            story: entry.story,
            args: { ...entry.story.args },
            generation: current.generation + 1,
            error: null,
            actions: new ActionStore(),
        }));
    };

    const onChange = (args: Args): void => {
        setState((current) => ({ ...current, args: { ...current.args, ...args } }));
    };

    return { state, boundArgs, reset, onChange };
};

type InspectorProps = PreviewProps & { actions: ActionStore; args: Args; onChange: (args: Args) => void };

const StoryInspector = ({ entry, actions, args, onChange }: InspectorProps): ReactNode => (
    <GtkScrolledWindow
        name="storybook-inspector"
        widthRequest={280}
        hscrollbarPolicy={Gtk.PolicyType.NEVER}
        vexpand
    >
        <GtkBox
            orientation={Gtk.Orientation.VERTICAL}
            spacing={24}
            marginTop={18}
            marginBottom={18}
            marginStart={12}
            marginEnd={12}
        >
            <Controls argTypes={entry.controls} args={args} onChange={onChange} />
            <ActionsPanel store={actions} />
        </GtkBox>
    </GtkScrolledWindow>
);

const StorybookPreview = ({ entry }: PreviewProps): ReactNode => {
    const { state, boundArgs, reset, onChange } = usePreviewState({ entry });

    return (
        <AdwToolbarView
            hexpand
            vexpand
            topBar={(
                <AdwHeaderBar
                    titleWidget={<AdwWindowTitle title={entry.name} subtitle={entry.title} />}
                    end={<GtkButton label="Reset story" onClicked={reset} />}
                />
            )}
        >
            <GtkBox>
                <GtkBox orientation={Gtk.Orientation.VERTICAL} hexpand vexpand>
                    <PreviewBoundary key={state.generation} args={state.args}>
                        {state.error === null
                            ? <PreviewContent story={entry.story} args={boundArgs} />
                            : (
                                    <AdwStatusPage
                                        name="storybook-preview-error"
                                        title="Story action failed"
                                        iconName="dialog-error-symbolic"
                                        description="Reset the preview or select another story to continue."
                                    />
                                )}
                    </PreviewBoundary>
                </GtkBox>
                <StoryInspector entry={entry} actions={state.actions} args={state.args} onChange={onChange} />
            </GtkBox>
        </AdwToolbarView>
    );
};

export { StorybookPreview };
