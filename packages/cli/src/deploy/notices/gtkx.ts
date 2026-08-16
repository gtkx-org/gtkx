import { sortStrings } from "@gtkx/utils";
import type { DeploySettings, Notice, NoticeSection } from "../types.js";
import type { BundledPackage } from "./packages.js";
import { BUNDLE_FILENAME } from "../../vite-plugins/esm-extension.js";

const TITLE = "GTKX";
const SCOPE = "@gtkx/";
const LICENSE_NAME = "MPL-2.0";
const LICENSE_URL = "https://www.mozilla.org/MPL/2.0/";
const REPOSITORY_URL = "https://github.com/gtkx-org/gtkx";
const NATIVE_FILENAME = "gtkx.node";
const CRATES_SUBJECT = "Rust crates linked into the GTKX native addon";
const CRATES_LICENSE = "MIT and Apache-2.0 and ISC and Unicode-3.0";
const CRATES_MANIFEST = "packages/native/Cargo.toml";

const isGtkxPackage = (entry: BundledPackage): boolean => entry.name.startsWith(SCOPE);

const getVersion = (packages: BundledPackage[]): string | null =>
    packages.map((entry) => entry.version).find((version) => version !== null) ?? null;

const getRepository = (packages: BundledPackage[]): string =>
    packages.map((entry) => entry.source).find((source) => source !== null) ?? REPOSITORY_URL;

const sourceFor = (packages: BundledPackage[]): string => {
    const repository = getRepository(packages);
    const version = getVersion(packages);

    return version === null ? repository : `${repository}/tree/v${version}`;
};

const cratesSourceFor = (packages: BundledPackage[]): string => `${sourceFor(packages)}/${CRATES_MANIFEST}`;

const modulesLine = (packages: BundledPackage[]): string[] =>
    packages.length === 0 ? [] : [`Modules: ${sortStrings(packages.map((entry) => entry.name)).join(", ")}.`];

const summaryFor = (settings: DeploySettings, packages: BundledPackage[]): string[] => {
    const lib = `lib/${settings.binaryName}`;

    return [
        "GTKX is the framework this application is built on. Its JavaScript is compiled into",
        `${lib}/${BUNDLE_FILENAME}, and its native addon is ${lib}/${NATIVE_FILENAME}.`,
        `The ${LICENSE_NAME} notice below covers the code GTKX wrote, all of which is in both files, and the`,
        `Mozilla Public License 2.0 is published at ${LICENSE_URL}.`,
        "Section 3.2(a) asks that whoever receives an executable form be told how to obtain the source code,",
        "which is what the source pointer below is for: it leads to the release these files were built from.",
        `The addon also statically links Rust crates GTKX did not write, so ${lib}/${NATIVE_FILENAME} is not`,
        `${LICENSE_NAME} alone. The second notice below names the licenses those crates carry; it does not`,
        `reproduce their texts, and ${CRATES_MANIFEST} in the source pointed at records which crates went in`,
        "and at which versions.",
        ...modulesLine(packages),
    ];
};

const getText = (packages: BundledPackage[]): string | null =>
    packages.map((entry) => entry.text).find((text) => text !== null) ?? null;

const getCopyright = (packages: BundledPackage[]): string[] =>
    sortStrings(new Set(packages.flatMap((entry) => entry.copyright)));

const subjectFor = (packages: BundledPackage[]): string => {
    const version = getVersion(packages);

    return version === null ? TITLE : `${TITLE} ${version}`;
};

const cratesNotice = (packages: BundledPackage[]): Notice => ({
    subject: CRATES_SUBJECT,
    license: CRATES_LICENSE,
    source: cratesSourceFor(packages),
    copyright: [],
    text: null,
});

const gtkxNotices = (settings: DeploySettings, packages: BundledPackage[]): NoticeSection => {
    const own = packages.filter((entry) => isGtkxPackage(entry));
    const lib = `lib/${settings.binaryName}`;

    return {
        title: TITLE,
        files: [`${lib}/${NATIVE_FILENAME}`, `${lib}/${BUNDLE_FILENAME}`],
        summary: summaryFor(settings, own),
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
