import type { ReactNode } from "react";
import * as Gio from "@gtkx/gi/gio";
import {
    AdwApplication,
    AdwApplicationWindow,
    AdwHeaderBar,
    AdwOverlaySplitView,
    AdwStatusPage,
    AdwToolbarView,
    AdwWindowTitle,
} from "@gtkx/jsx/adw";
import { quit } from "@gtkx/react";
import { useCallback, useEffect, useEffectEvent, useState, useSyncExternalStore } from "react";
import type { StoryCatalog } from "./catalog.js";
import { StoryNavigator } from "./explorer-navigator.js";
import { StorybookPreview } from "./explorer-preview.js";

/** Configuration for the native Storybook application shell. */
type StorybookProps = {
    /** Source catalog whose stories and loading errors appear in the explorer. */
    catalog: StoryCatalog;
    /** Gio application identifier; defaults to org.gtkx.Storybook. */
    applicationId?: string;
    /** Explorer window and sidebar title; defaults to GTKX Storybook. */
    title?: string;
    /** Story selected once the catalog lists it; the first story is selected otherwise. */
    initialStoryId?: string | undefined;
    /** Called with the identifier of each story the explorer selects. */
    onStorySelected?: ((id: string) => void) | undefined;
};

type StorybookViewProps = Pick<StorybookProps, "catalog" | "title" | "initialStoryId" | "onStorySelected">;

const storyCount = (count: number): string => (count === 1 ? "1 story" : `${String(count)} stories`);

const StorybookView = ({
    catalog,
    title = "GTKX Storybook",
    initialStoryId,
    onStorySelected,
}: StorybookViewProps): ReactNode => {
    const subscribe = useCallback((listener: () => void) => catalog.subscribe(listener), [catalog]);
    const getSnapshot = useCallback(() => catalog.getSnapshot(), [catalog]);
    const snapshot = useSyncExternalStore(subscribe, getSnapshot);
    const [selectedId, setSelectedId] = useState(initialStoryId);
    const selected = snapshot.stories.find((entry) => entry.id === selectedId) ?? snapshot.stories[0];

    if (selected !== undefined && selectedId !== selected.id) {
        setSelectedId(selected.id);
    }

    const selectedStoryId = selected?.id;
    const reportSelection = useEffectEvent((id: string) => {
        onStorySelected?.(id);
    });

    useEffect(() => {
        if (selectedStoryId !== undefined) {
            reportSelection(selectedStoryId);
        }
    }, [selectedStoryId]);

    return (
        <AdwOverlaySplitView
            minSidebarWidth={220}
            maxSidebarWidth={300}
            sidebar={
                <AdwToolbarView
                    top={
                        <AdwHeaderBar
                            titleWidget={
                                <AdwWindowTitle title={title} subtitle={storyCount(snapshot.stories.length)} />
                            }
                        />
                    }
                >
                    <StoryNavigator
                        stories={snapshot.stories}
                        errors={snapshot.errors}
                        selectedId={selectedStoryId}
                        onSelect={setSelectedId}
                    />
                </AdwToolbarView>
            }
        >
            {selected ? (
                <StorybookPreview key={selected.id} entry={selected} />
            ) : (
                <AdwToolbarView top={<AdwHeaderBar />}>
                    <AdwStatusPage
                        name="storybook-empty"
                        title={snapshot.isLoading ? "Loading stories" : "Choose a story"}
                        iconName="applications-development-symbolic"
                        description="Stories from your project appear in the sidebar."
                    />
                </AdwToolbarView>
            )}
        </AdwOverlaySplitView>
    );
};

/** Renders the Adwaita explorer application with navigation, story previews, controls, and actions. */
const Storybook = ({
    catalog,
    applicationId = "org.gtkx.Storybook",
    title = "GTKX Storybook",
    initialStoryId,
    onStorySelected,
}: StorybookProps): ReactNode => (
    <AdwApplication applicationId={applicationId} flags={Gio.ApplicationFlags.NON_UNIQUE}>
        <AdwApplicationWindow title={title} defaultWidth={1200} defaultHeight={800} onCloseRequest={quit}>
            <StorybookView
                catalog={catalog}
                title={title}
                initialStoryId={initialStoryId}
                onStorySelected={onStorySelected}
            />
        </AdwApplicationWindow>
    </AdwApplication>
);

export { Storybook };
