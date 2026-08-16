import { warn } from "@gtkx/utils";
import type { DeploySettings, Notice, NoticeSection } from "../types.js";
import type { BundledPackage } from "./packages.js";
import { BUNDLE_FILENAME } from "../../vite-plugins/esm-extension.js";
import { isGtkxPackage } from "./gtkx.js";

const TITLE = "Bundled JavaScript dependencies";
const UNKNOWN_LICENSE = "unknown";

const SUMMARY = [
    "Every package listed here is compiled into the application bundle, so its own terms travel with this",
    "package. A dependency that ships a license file has it reproduced in full below; one that only declares",
    "an SPDX identifier is listed with that identifier and with where its source can be obtained.",
];

const subjectFor = (entry: BundledPackage): string =>
    entry.version === null ? entry.name : `${entry.name} ${entry.version}`;

const noticeFor = (entry: BundledPackage): Notice => ({
    subject: subjectFor(entry),
    license: entry.license ?? UNKNOWN_LICENSE,
    source: entry.source,
    copyright: entry.copyright,
    text: entry.text,
});

const warnUndeclared = (entries: BundledPackage[]): void => {
    const undeclared = entries.filter((entry) => entry.isPresent && entry.license === null && entry.text === null);

    if (undeclared.length === 0) {
        return;
    }

    warn(
        `The third-party notices list ${undeclared.map((entry) => subjectFor(entry)).join(", ")} without any ` +
        "license: the package declares no SPDX identifier and ships no license file. Check what the terms are " +
        "before you publish this build, and ask upstream to record them.",
    );
};

const dependencyNotices = (settings: DeploySettings, packages: BundledPackage[]): NoticeSection => {
    const bundled = packages.filter((entry) => !isGtkxPackage(entry));
    warnUndeclared(bundled);

    return {
        title: TITLE,
        files: [`lib/${settings.binaryName}/${BUNDLE_FILENAME}`],
        summary: SUMMARY,
        notices: bundled.map((entry) => noticeFor(entry)),
    };
};

export { dependencyNotices };
