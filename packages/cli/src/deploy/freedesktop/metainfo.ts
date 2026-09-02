import type { DeploySettings } from "../types.js";
import {
    brandingSection,
    contentRatingSection,
    descriptionSection,
    developerSection,
    listSection,
    providesSection,
    releasesSection,
    screenshotsSection,
    urlsSection,
} from "./metainfo-sections.js";
import { element, renderDocument, text, type XmlNode } from "./xml.js";

const COMPONENT_TYPE = "desktop-application";
const DESKTOP_SUFFIX = ".desktop";
const COMPONENT_CLOSE = "</component>\n";
const PROVIDES_CLOSE = "    </provides>\n";
const PROVIDES_FRAGMENT = /^<provides\s*>([\s\S]*)<\/provides>$/;

const normalizeExtraFragment = (fragment: string, index: number): string => {
    const normalized = fragment.trim();

    if (normalized.length === 0) {
        throw new Error(`Cannot render deploy.metainfoExtra entry ${String(index + 1)}: it is empty`);
    }

    return normalized;
};

const indentFragment = (fragment: string, depth: number): string => {
    const indentation = " ".repeat(depth * 4);

    return fragment.split(/\r?\n/).map((line) => `${indentation}${line}`).join("\n");
};

const appendExtraFragments = (document: string, fragments: string[]): string => {
    if (fragments.length === 0) {
        return document;
    }

    let merged = document;
    const componentFragments: string[] = [];

    for (const [index, rawFragment] of fragments.entries()) {
        const fragment = normalizeExtraFragment(rawFragment, index);
        const provides = PROVIDES_FRAGMENT.exec(fragment)?.[1]?.trim();

        if (provides === undefined) {
            componentFragments.push(fragment);
            continue;
        }

        merged = merged.replace(PROVIDES_CLOSE, () => `${indentFragment(provides, 2)}\n${PROVIDES_CLOSE}`);
    }

    if (componentFragments.length === 0) {
        return merged;
    }

    const extra = componentFragments.map((fragment) => indentFragment(fragment, 1)).join("\n");

    return merged.replace(COMPONENT_CLOSE, () => `${extra}\n${COMPONENT_CLOSE}`);
};

const launchable = (applicationId: string): XmlNode => ({
    tag: "launchable",
    attributes: { type: "desktop-id" },
    text: `${applicationId}${DESKTOP_SUFFIX}`,
});

const metainfoRoot = (settings: DeploySettings): XmlNode =>
    element("component", { type: COMPONENT_TYPE }, [
        text("id", settings.applicationId),
        text("name", settings.name),
        text("summary", settings.summary),
        text("metadata_license", settings.metadataLicense),
        text("project_license", settings.license),
        ...developerSection(settings),
        ...descriptionSection(settings),
        launchable(settings.applicationId),
        ...providesSection(settings),
        ...listSection("categories", "category", settings.categories),
        ...listSection("keywords", "keyword", settings.keywords),
        ...urlsSection(settings),
        ...screenshotsSection(settings),
        ...releasesSection(settings),
        ...contentRatingSection(settings),
        ...brandingSection(settings),
    ]);

const renderMetainfo = (settings: DeploySettings): string => {
    const document = renderDocument(metainfoRoot(settings));

    return appendExtraFragments(document, settings.deploy.metainfoExtra ?? []);
};

export { renderMetainfo };
