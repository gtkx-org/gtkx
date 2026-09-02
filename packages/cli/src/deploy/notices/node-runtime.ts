import { warn } from "@gtkx/utils";
import type { DeploySettings, NodeRuntime, NoticeSection } from "../types.js";
import { resolveNodeVersion, sourcePathFor } from "../node-runtime/index.js";
import { licenseBesideNode } from "../node-runtime/license.js";
import { NODE_FILENAME } from "../payload/launcher.js";
import { nodeLicenseDestination } from "../payload/stage.js";
import { copyrightLines, readLicenseText } from "./text.js";

const TITLE = "Node.js runtime";
const LICENSE_NAME = "Node.js";
const SOURCE_URL = "https://github.com/nodejs/node";
const LICENSE_URL = "https://github.com/nodejs/node/blob/main/LICENSE";

const SUMMARY = [
    "This package carries the Node.js runtime that runs the application. Its license is the one Node.js",
    "publishes as a single document, covering Node.js itself under the MIT terms together with the",
    "components it embeds under theirs, among them V8, OpenSSL, ICU, libuv, zlib, brotli and llhttp.",
];

const CARRIED_SUMMARY = ["The notice below is that document, reproduced from the release this package bundles."];

const MISSING_SUMMARY = [
    "This run had no copy of that document at hand, so the notice below names it and it is published at",
    `${LICENSE_URL}.`,
];

const MISSING_LICENSE =
    "Cannot read a license file for the Node.js runtime this deploy bundles. An official release unpacks it " +
    'next to the binary, so point `deploy.node.path` at one, or use `deploy.node.source: "download"`, and ' +
    "the notices carry it.";

const isSourceMode = (settings: DeploySettings): boolean => settings.deploy.flatpak?.mode === "source";

const versionFor = (settings: DeploySettings, node: NodeRuntime | null): string =>
    node?.version ?? resolveNodeVersion(settings);

const licenseFileFor = (settings: DeploySettings, node: NodeRuntime | null): string | null => {
    if (node !== null) {
        return node.licenseFile;
    }

    if ((settings.deploy.node?.source ?? "download") === "download") {
        return null;
    }

    return licenseBesideNode(sourcePathFor(settings));
};

const textFor = (settings: DeploySettings, node: NodeRuntime | null): string | null => {
    const licenseFile = licenseFileFor(settings, node);

    return licenseFile === null ? null : readLicenseText(licenseFile);
};

const extensionSummary = (settings: DeploySettings): string[] => [
    "The flatpak built from source copies its runtime out of the Node SDK extension in the build sandbox.",
    `That build installs the license file the extension ships as ${nodeLicenseDestination(settings)}, and`,
    "installs nothing when the extension ships none, so read the text at the address above if that file is",
    "not in the package you received.",
];

const carriedSummary = (settings: DeploySettings, text: string | null): string[] => {
    if (isSourceMode(settings)) {
        return [...MISSING_SUMMARY, ...extensionSummary(settings)];
    }

    return text === null ? MISSING_SUMMARY : CARRIED_SUMMARY;
};

const summaryFor = (settings: DeploySettings, text: string | null): string[] => [
    ...SUMMARY,
    ...carriedSummary(settings, text),
];

const warnMissingLicense = (node: NodeRuntime | null, text: string | null): void => {
    if (node === null || text !== null) {
        return;
    }

    warn(MISSING_LICENSE);
};

const nodeNotices = (settings: DeploySettings, node: NodeRuntime | null): NoticeSection => {
    const text = textFor(settings, node);
    warnMissingLicense(node, text);

    return {
        title: TITLE,
        files: [`lib/${settings.binaryName}/${NODE_FILENAME}`],
        summary: summaryFor(settings, text),
        notices: [{
            subject: `Node.js ${versionFor(settings, node)}`,
            license: LICENSE_NAME,
            source: SOURCE_URL,
            copyright: copyrightLines(text),
            text,
        }],
    };
};

export { nodeNotices };
