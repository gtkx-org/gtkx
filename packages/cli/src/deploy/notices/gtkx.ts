import { sortStrings } from "@gtkx/utils";
import type { RecordedPackage } from "../../internal/build-manifest.js";
import type { Notice, NoticeSection } from "../types.js";

const TITLE = "GTKX";
const SCOPE = "@gtkx/";
const LICENSE_NAME = "MPL-2.0";
const LICENSE_URL = "https://www.mozilla.org/MPL/2.0/";
const REPOSITORY_URL = "https://github.com/gtkx-org/gtkx";
const CRATES_SUBJECT = "Rust crates linked into the GTKX native addon";
const CRATES_LICENSE = "MIT and Apache-2.0 and ISC and Unicode-3.0";
const CRATES_MANIFEST = "packages/native/Cargo.toml";

const isGtkxPackage = (entry: RecordedPackage): boolean => entry.name.startsWith(SCOPE);

const getVersion = (packages: RecordedPackage[]): string | null =>
    packages.map((entry) => entry.version).find((version) => version !== null) ?? null;

const getRepository = (packages: RecordedPackage[]): string =>
    packages.map((entry) => entry.source).find((source) => source !== null) ?? REPOSITORY_URL;

const sourceFor = (packages: RecordedPackage[]): string => {
    const repository = getRepository(packages);
    const version = getVersion(packages);

    return version === null ? repository : `${repository}/tree/v${version}`;
};

const cratesSourceFor = (packages: RecordedPackage[]): string => `${sourceFor(packages)}/${CRATES_MANIFEST}`;

const modulesLine = (packages: RecordedPackage[]): string[] =>
    packages.length === 0 ? [] : [`Modules: ${sortStrings(packages.map((entry) => entry.name)).join(", ")}.`];

const summaryFor = (bundleFile: string, addonFile: string, packages: RecordedPackage[]): string[] => [
    "GTKX is the framework this application is built on. Its JavaScript is compiled into",
    `${bundleFile}, and its native addon is ${addonFile}.`,
    `The ${LICENSE_NAME} notice below covers the code GTKX wrote, all of which is in both files, and the`,
    `Mozilla Public License 2.0 is published at ${LICENSE_URL}.`,
    "Section 3.2(a) asks that whoever receives an executable form be told how to obtain the source code,",
    "which is what the source pointer below is for: it leads to the release these files were built from.",
    `The addon also statically links Rust crates GTKX did not write, so ${addonFile} is not`,
    `${LICENSE_NAME} alone. The crates notice below names the licenses those crates carry; it does not`,
    `reproduce their texts, and ${CRATES_MANIFEST} in the source pointed at records which crates went in`,
    "and at which versions.",
    ...modulesLine(packages),
];

const getText = (packages: RecordedPackage[]): string | null =>
    packages.map((entry) => entry.text).find((text) => text !== null) ?? null;

const getCopyright = (packages: RecordedPackage[]): string[] =>
    sortStrings(new Set(packages.flatMap((entry) => entry.copyright)));

const subjectFor = (packages: RecordedPackage[]): string => {
    const version = getVersion(packages);

    return version === null ? TITLE : `${TITLE} ${version}`;
};

const cratesNotice = (packages: RecordedPackage[]): Notice => ({
    subject: CRATES_SUBJECT,
    license: CRATES_LICENSE,
    source: cratesSourceFor(packages),
    copyright: [],
    text: null,
});

const gtkxNotices = (bundleFile: string, addonFile: string, packages: RecordedPackage[]): NoticeSection => {
    const own = packages.filter((entry) => isGtkxPackage(entry));

    return {
        title: TITLE,
        files: [addonFile, bundleFile],
        summary: summaryFor(bundleFile, addonFile, own),
        notices: [{
            subject: subjectFor(own),
            license: LICENSE_NAME,
            source: sourceFor(own),
            copyright: getCopyright(own),
            text: getText(own),
        }, cratesNotice(own)],
    };
};

export { gtkxNotices, isGtkxPackage };
