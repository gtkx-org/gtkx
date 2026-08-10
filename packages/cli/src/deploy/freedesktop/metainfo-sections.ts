import type { DeployRelease, DeploySettings } from "../types.js";
import { element, text, type XmlNode } from "./xml.js";

const CONTENT_RATING_TYPE = "oars-1.1";
const DEFAULT_SCREENSHOT_TYPE = "default";
const PRIMARY_COLOR = "primary";

const developerSection = (settings: DeploySettings): XmlNode[] => {
    const attributes = settings.developer.id === null ? {} : { id: settings.developer.id };

    return [element("developer", attributes, [text("name", settings.developer.name)])];
};

const descriptionSection = (settings: DeploySettings): XmlNode[] => [
    element("description", {}, settings.description.map((paragraph) => text("p", paragraph))),
];

const providesSection = (settings: DeploySettings): XmlNode[] => [
    element("provides", {}, [
        text("binary", settings.binaryName),
        ...settings.mimeTypes.map((mimeType) => text("mediatype", mimeType)),
    ]),
];

const listSection = (tag: string, itemTag: string, values: string[]): XmlNode[] =>
    values.length === 0 ? [] : [element(tag, {}, values.map((value) => text(itemTag, value)))];

const urlsSection = (settings: DeploySettings): XmlNode[] => {
    const homepage = settings.homepage === null ? [] : [{ tag: "homepage", url: settings.homepage }];
    const rest = Object.entries(settings.urls).map(([tag, url]) => ({ tag, url }));

    return [...homepage, ...rest].map((entry) => ({ tag: "url", attributes: { type: entry.tag }, text: entry.url }));
};

const screenshotsSection = (settings: DeploySettings): XmlNode[] => {
    if (settings.screenshots.length === 0) {
        return [];
    }

    const entries = settings.screenshots.map((screenshot) =>
        element(
            "screenshot",
            screenshot.isDefault ? { type: DEFAULT_SCREENSHOT_TYPE } : {},
            [
                text("image", screenshot.url),
                ...(screenshot.caption === null ? [] : [text("caption", screenshot.caption)]),
            ],
        ));

    return [element("screenshots", {}, entries)];
};

const releaseAttributes = (release: DeployRelease): Record<string, string> => ({
    version: release.version,
    date: release.date,
    ...(release.type !== null && { type: release.type }),
    ...(release.urgency !== null && { urgency: release.urgency }),
});

const releaseChildren = (release: DeployRelease): XmlNode[] => [
    ...(release.url === null ? [] : [{ tag: "url", attributes: { type: "details" }, text: release.url }]),
    ...(release.notes.length === 0
        ? []
        : [element("description", {}, release.notes.map((note) => text("p", note)))]),
];

const releasesSection = (settings: DeploySettings): XmlNode[] => {
    if (settings.releases.length === 0) {
        return [];
    }

    const entries = settings.releases.map((release) =>
        element("release", releaseAttributes(release), releaseChildren(release)));

    return [element("releases", {}, entries)];
};

const contentRatingSection = (settings: DeploySettings): XmlNode[] => [
    element(
        "content_rating",
        { type: CONTENT_RATING_TYPE },
        Object.entries(settings.contentRating).map(([id, intensity]) => ({
            tag: "content_attribute",
            attributes: { id },
            text: intensity,
        })),
    ),
];

const brandingSection = (settings: DeploySettings): XmlNode[] => {
    const branding = settings.branding;

    if (branding === null) {
        return [];
    }

    const color = (scheme: string, value: string): XmlNode => ({
        tag: "color",
        attributes: { type: PRIMARY_COLOR, scheme_preference: scheme },
        text: value,
    });

    return [element("branding", {}, [color("light", branding.light), color("dark", branding.dark)])];
};

export {
    brandingSection,
    contentRatingSection,
    descriptionSection,
    developerSection,
    listSection,
    providesSection,
    releasesSection,
    screenshotsSection,
    urlsSection,
};
