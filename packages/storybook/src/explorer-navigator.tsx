import type { ReactNode } from "react";
import { markupEscapeText } from "@gtkx/gi/glib";
import * as Gtk from "@gtkx/gi/gtk";
import { AdwActionRow, AdwStatusPage } from "@gtkx/jsx/adw";
import { GtkBox, GtkLabel, GtkListBox, GtkScrolledWindow, GtkSearchEntry } from "@gtkx/jsx/gtk";
import { useState } from "react";
import type { StoryEntry, StoryLoadError } from "./catalog.js";

type NavigatorProps = {
    stories: StoryEntry[];
    errors: StoryLoadError[];
    selectedId: string | undefined;
    onSelect: (id: string) => void;
};

type GroupProps = Pick<NavigatorProps, "selectedId" | "onSelect"> & {
    title: string;
    entries: StoryEntry[];
};

type Group = {
    title: string;
    entries: StoryEntry[];
    path: number[];
};

const TITLE_SEPARATOR = "/";

const titlePrefixes = (title: string): string[] =>
    title.split(TITLE_SEPARATOR).map((_, index, segments) => segments.slice(0, index + 1).join(TITLE_SEPARATOR));

const compareIndexPaths = (left: number[], right: number[]): number => {
    for (const [index, value] of left.entries()) {
        const other = right[index];

        if (other === undefined) {
            return 1;
        }

        if (value !== other) {
            return value - other;
        }
    }

    return left.length - right.length;
};

/**
 * Groups stories by title, keeping titles that share a path prefix together as Storybook's sidebar nests
 * them: the first title under each prefix decides where the prefix appears.
 */
const groupStoriesByTitle = (stories: StoryEntry[]): Group[] => {
    const firstOccurrence: Map<string, number> = new Map();
    const groups = [...Map.groupBy(stories, (entry) => entry.title)].map(([title, entries], order) => ({
        title,
        entries,
        path: titlePrefixes(title).map((prefix) => firstOccurrence.getOrInsert(prefix, order)),
    }));

    return groups.toSorted((left, right) => compareIndexPaths(left.path, right.path));
};

const StoryGroup = ({ title, entries, selectedId, onSelect }: GroupProps): ReactNode => (
    <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={6}>
        <GtkLabel label={title} xalign={0} marginStart={18} marginEnd={18} cssClasses={["heading"]} wrap />
        <GtkListBox
            cssClasses={["navigation-sidebar"]}
            selectedIndex={entries.findIndex((entry) => entry.id === selectedId)}
            onRowSelected={(row) => {
                const entry = row === null ? undefined : entries[row.getIndex()];

                if (entry) {
                    onSelect(entry.id);
                }
            }}
        >
            {entries.map((entry) => (
                <AdwActionRow
                    key={entry.id}
                    name={`storybook-story-${entry.id}`}
                    title={markupEscapeText(entry.name, -1)}
                    activatable
                    onActivated={() => {
                        onSelect(entry.id);
                    }}
                />
            ))}
        </GtkListBox>
    </GtkBox>
);

const LoadErrors = ({ errors }: Pick<NavigatorProps, "errors">): ReactNode =>
    errors.length > 0 && (
        <GtkBox name="storybook-load-errors" orientation={Gtk.Orientation.VERTICAL} spacing={6}>
            {errors.map(({ source, error }, index) => (
                <GtkLabel
                    key={`${source}-${String(index)}`}
                    label={`${source}\n${error.message.slice(0, 500)}`}
                    cssClasses={["error"]}
                    marginStart={18}
                    marginEnd={18}
                    wrap
                    selectable
                    xalign={0}
                />
            ))}
        </GtkBox>
    );

const StoryNavigator = ({ stories, errors, selectedId, onSelect }: NavigatorProps): ReactNode => {
    const [search, setSearch] = useState("");
    const query = search.trim().toLocaleLowerCase();
    const groups = groupStoriesByTitle(
        stories.filter((entry) => `${entry.title} ${entry.name}`.toLocaleLowerCase().includes(query)),
    );

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
            <GtkSearchEntry
                name="storybook-search"
                placeholderText="Search stories"
                text={search}
                marginStart={12}
                marginEnd={12}
                onChanged={(entry) => {
                    setSearch(entry.getText());
                }}
            />
            <GtkScrolledWindow hscrollbarPolicy={Gtk.PolicyType.NEVER} vexpand>
                <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={18} marginBottom={18}>
                    {groups.map(({ title, entries }) => (
                        <StoryGroup
                            key={title}
                            title={title}
                            entries={entries}
                            selectedId={selectedId}
                            onSelect={onSelect}
                        />
                    ))}
                    {groups.length === 0 && (
                        <AdwStatusPage
                            name="storybook-no-matches"
                            title={query ? "No matching stories" : "No stories"}
                            iconName="system-search-symbolic"
                            cssClasses={["compact"]}
                        />
                    )}
                    <LoadErrors errors={errors} />
                </GtkBox>
            </GtkScrolledWindow>
        </GtkBox>
    );
};

export { StoryNavigator };
