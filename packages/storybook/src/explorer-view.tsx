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
import { useCallback, useState, useSyncExternalStore } from "react";
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
};

type StorybookViewProps = Pick<StorybookProps, "catalog" | "title">;

const StorybookView = ({ catalog, title = "GTKX Storybook" }: StorybookViewProps): ReactNode => {
    const subscribe = useCallback((listener: () => void) => catalog.subscribe(listener), [catalog]);
    const getSnapshot = useCallback(() => catalog.getSnapshot(), [catalog]);
    const snapshot = useSyncExternalStore(subscribe, getSnapshot);
    const [selectedId, setSelectedId] = useState<string>();
    const selected = snapshot.stories.find((entry) => entry.id === selectedId) ?? snapshot.stories[0];

    if (selectedId !== selected?.id) {
        setSelectedId(selected?.id);
    }

    return (
        <AdwOverlaySplitView
            minSidebarWidth={220}
            maxSidebarWidth={300}
            sidebar={(
                <AdwToolbarView
                    topBar={(
                        <AdwHeaderBar
                            titleWidget={(
                                <AdwWindowTitle title={title} subtitle={`${String(snapshot.stories.length)} stories`} />
                            )}
                        />
                    )}
                >
                    <StoryNavigator
                        stories={snapshot.stories}
                        errors={snapshot.errors}
                        selectedId={selected?.id}
                        onSelect={setSelectedId}
                    />
                </AdwToolbarView>
            )}
        >
            {selected
                ? <StorybookPreview key={selected.id} entry={selected} />
                : (
                        <AdwToolbarView topBar={<AdwHeaderBar />}>
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
}: StorybookProps): ReactNode => (
    <AdwApplication applicationId={applicationId} flags={Gio.ApplicationFlags.NON_UNIQUE}>
        <AdwApplicationWindow title={title} defaultWidth={1200} defaultHeight={800} onCloseRequest={quit}>
            <StorybookView catalog={catalog} title={title} />
        </AdwApplicationWindow>
    </AdwApplication>
);

export { Storybook };
