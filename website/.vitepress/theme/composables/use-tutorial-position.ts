import { type DefaultTheme, useData } from "vitepress";
import { computed, type ComputedRef } from "vue";
import { documentationLink, TUTORIAL_ROOT } from "../../versioning.js";
import { useDocumentationVersion } from "./use-documentation-version";

type TutorialLink = {
    label: string;
    text: string;
    link: string;
};

type TutorialPosition = {
    chapter?: number;
    total: number;
    previous?: TutorialLink;
    next?: TutorialLink;
};

const FIRST_NUMBERED_MAJOR = 2;

const pageLink = (relativePath: string): string =>
    `/${relativePath.replace(/(^|\/)index\.md$/, "$1").replace(/\.md$/, "")}`;

const sidebarLinks = (items: DefaultTheme.SidebarItem[]): DefaultTheme.SidebarItem[] =>
    items.flatMap((item) => [...(item.link === undefined ? [] : [item]), ...sidebarLinks(item.items ?? [])]);

const sidebarItems = (sidebar: DefaultTheme.Sidebar | undefined, key: string): DefaultTheme.SidebarItem[] => {
    if (sidebar === undefined || Array.isArray(sidebar)) {
        return [];
    }

    const entry = sidebar[key];

    if (entry === undefined) {
        return [];
    }

    return Array.isArray(entry) ? entry : entry.items;
};

const tutorialLink = (links: DefaultTheme.SidebarItem[], index: number): TutorialLink | undefined => {
    const item = links[index];

    if (item?.link === undefined || item.text === undefined) {
        return undefined;
    }

    return { label: index === 0 ? "Tutorial" : `Chapter ${index}`, text: item.text, link: item.link };
};

/**
 * Locates the current page in a numbered tutorial, or returns `undefined` outside one. Chapters are numbered by
 * their sidebar order after the unnumbered introduction; tutorials before 2.0 stay unnumbered.
 */
const useTutorialPosition = (): ComputedRef<TutorialPosition | undefined> => {
    const { theme, page } = useData<DefaultTheme.Config>();
    const { version } = useDocumentationVersion();

    return computed(() => {
        if (Number.parseInt(version.value.id, 10) < FIRST_NUMBERED_MAJOR) {
            return undefined;
        }

        const root = documentationLink(version.value, TUTORIAL_ROOT);
        const path = pageLink(page.value.relativePath);
        const links = sidebarLinks(sidebarItems(theme.value.sidebar, root));

        if (!path.startsWith(root) || links.length === 0) {
            return undefined;
        }

        const index = links.findIndex((item) => item.link === path);

        if (index < 0) {
            return { total: links.length - 1 };
        }

        return {
            chapter: index === 0 ? undefined : index,
            total: links.length - 1,
            previous: tutorialLink(links, index - 1),
            next: tutorialLink(links, index + 1),
        };
    });
};

export { type TutorialLink, type TutorialPosition, useTutorialPosition };
