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

const launchable = (applicationId: string): XmlNode => ({
    tag: "launchable",
    attributes: { type: "desktop-id" },
    text: `${applicationId}${DESKTOP_SUFFIX}`,
});

const renderMetainfo = (settings: DeploySettings): string =>
    renderDocument(
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
        ]),
    );

export { renderMetainfo };
