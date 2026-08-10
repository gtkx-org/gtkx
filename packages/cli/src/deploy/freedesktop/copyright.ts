import { readFileSync } from "node:fs";
import type { DeploySettings } from "../types.js";

const FORMAT_URL = "https://www.debian.org/doc/packaging-manuals/copyright-format/1.0/";
const CONTINUATION_BLANK = " .";

const indentLicenseBody = (body: string): string[] =>
    body
        .split("\n")
        .map((line) => (line.trim().length === 0 ? CONTINUATION_BLANK : ` ${line}`));

const licenseBody = (licenseFile: string | null): string[] => {
    if (licenseFile === null) {
        return [];
    }

    try {
        return indentLicenseBody(readFileSync(licenseFile, "utf8").trimEnd());
    } catch {
        return [];
    }
};

const headerLines = (settings: DeploySettings): string[] => [
    `Format: ${FORMAT_URL}`,
    `Upstream-Name: ${settings.name}`,
    ...(settings.homepage === null ? [] : [`Source: ${settings.homepage}`]),
];

const renderCopyright = (settings: DeploySettings): string =>
    [
        ...headerLines(settings),
        "",
        "Files: *",
        `Copyright: ${settings.copyright}`,
        `License: ${settings.license}`,
        ...licenseBody(settings.paths.licenseFile),
        "",
    ].join("\n");

export { renderCopyright };
