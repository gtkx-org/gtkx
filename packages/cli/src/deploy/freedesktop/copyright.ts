import parseSpdx from "spdx-expression-parse";
import type { DeploySettings, Notice, NoticeSection } from "../types.js";
import { BUNDLE_FILENAME } from "../../vite-plugins/esm-extension.js";
import { readLicenseText } from "../notices/text.js";

type FileStanza = {
    settings: DeploySettings;
    files: string;
    sections: NoticeSection[];
    reproduced: Set<string>;
};

const FORMAT_URL = "https://www.debian.org/doc/packaging-manuals/copyright-format/1.0/";
const CONTINUATION_BLANK = " .";
const UNKNOWN_COPYRIGHT = "unknown";
const UNKNOWN_LICENSE = "unknown";
const LICENSE_SEPARATOR = " and ";
const GROUPED_LICENSE_SEPARATOR = ", and ";
const LICENSE_CHOICE = " or ";
const OUTSIDE_NAME = /[^\w.+-]+/g;
const NAME_JOINER = "-";

const indentLine = (line: string): string => (line.trim().length === 0 ? CONTINUATION_BLANK : ` ${line}`);

const foldedField = (name: string, lines: string[]): string[] => {
    const [first, ...rest] = lines;

    return first === undefined ? [] : [`${name}: ${first}`, ...rest.map((line) => indentLine(line))];
};

const customName = (license: string): string =>
    license.split(OUTSIDE_NAME).filter((token) => token.length > 0).join(NAME_JOINER);

const licenseName = (expression: parseSpdx.LicenseInfo): string => {
    const name = customName(expression.license) + (expression.plus === true ? "+" : "");

    return expression.exception === undefined ? name : `${name} with ${customName(expression.exception)} exception`;
};

const expressionClauses = (expression: parseSpdx.Info): string[][] => {
    if ("license" in expression) {
        return [[licenseName(expression)]];
    }

    const left = expressionClauses(expression.left);
    const right = expressionClauses(expression.right);

    return expression.conjunction === "and"
        ? [...left, ...right]
        : left.flatMap((choice) => right.map((alternative) => [...choice, ...alternative]));
};

const licenseClauses = (license: string): string[][] => {
    let expression: parseSpdx.Info;

    try {
        expression = parseSpdx(license);
    } catch {
        const name = customName(license);

        return name.length === 0 ? [] : [[name]];
    }

    return expressionClauses(expression);
};

const licenseNames = (notices: Notice[]): string => {
    const clauses = notices.flatMap((notice) => licenseClauses(notice.license));
    const names = [...new Set(clauses.map((clause) => [...new Set(clause)].join(LICENSE_CHOICE)))];
    const separator = clauses.some((clause) => clause.length > 1)
        ? GROUPED_LICENSE_SEPARATOR
        : LICENSE_SEPARATOR;

    return names.length === 0 ? UNKNOWN_LICENSE : names.join(separator);
};

const compactNotice = (notice: Notice): string => {
    const label = `${notice.subject} (${notice.license})`;

    return notice.source === null ? label : `${label}: ${notice.source}`;
};

const noticeBody = (notice: Notice, reproduced: Set<string>): string[] => {
    const head = [
        "",
        `${notice.subject} (${notice.license})`,
        ...(notice.source === null ? [] : [`Source: ${notice.source}`]),
    ];

    if (notice.text === null || reproduced.has(notice.text)) {
        return head;
    }

    reproduced.add(notice.text);

    return [...head, "", ...notice.text.split("\n")];
};

const copyrightNames = (notices: Notice[]): string[] => {
    const lines = [...new Set(notices.flatMap((notice) => notice.copyright))];

    return lines.length === 0 ? [UNKNOWN_COPYRIGHT] : lines;
};

const stanzaComment = (sections: NoticeSection[]): string[] =>
    sections.flatMap((section, index) => [...(index === 0 ? [] : [""]), section.title, ...section.summary]);

const sectionComment = (section: NoticeSection): string[] => [
    section.title,
    "",
    ...section.summary,
    "",
    ...section.notices.map((notice) => compactNotice(notice)),
];

const bundlePath = (settings: DeploySettings): string => `lib/${settings.binaryName}/${BUNDLE_FILENAME}`;

const applicationNotice = (settings: DeploySettings): Notice => ({
    subject: settings.name,
    license: settings.license,
    source: settings.homepage,
    copyright: [settings.copyright],
    text: null,
});

const stanzaNotices = (settings: DeploySettings, files: string, sections: NoticeSection[]): Notice[] => {
    const own = files === bundlePath(settings) ? [applicationNotice(settings)] : [];

    return [...own, ...sections.flatMap((section) => section.notices)];
};

const fileStanza = ({ settings, files, sections, reproduced }: FileStanza): string[] => {
    const notices = stanzaNotices(settings, files, sections);
    const texts = notices.flatMap((notice) => noticeBody(notice, reproduced));

    return [
        `Files: ${files}`,
        ...foldedField("Comment", stanzaComment(sections)),
        ...foldedField("Copyright", copyrightNames(notices)),
        ...foldedField("License", [licenseNames(notices), ...texts]),
        "",
    ];
};

const filePatterns = (sections: NoticeSection[]): string[] =>
    [...new Set(sections.flatMap((section) => section.files))];

const sectionsFor = (sections: NoticeSection[], files: string): NoticeSection[] =>
    sections.filter((section) => section.files.includes(files));

const headerComment = (sections: NoticeSection[]): string[] =>
    sections.filter((section) => section.files.length === 0).flatMap((section) => sectionComment(section));

const headerLines = (settings: DeploySettings, sections: NoticeSection[]): string[] => [
    `Format: ${FORMAT_URL}`,
    `Upstream-Name: ${settings.name}`,
    ...(settings.homepage === null ? [] : [`Source: ${settings.homepage}`]),
    ...foldedField("Comment", headerComment(sections)),
];

const applicationStanza = (settings: DeploySettings, text: string | null, reproduced: Set<string>): string[] => [
    "Files: *",
    `Copyright: ${settings.copyright}`,
    ...foldedField("License", [
        licenseNames([applicationNotice(settings)]),
        ...noticeBody({ ...applicationNotice(settings), text }, reproduced),
    ]),
    "",
];

const renderCopyright = (settings: DeploySettings, sections: NoticeSection[]): string => {
    const own = settings.paths.licenseFile === null ? null : readLicenseText(settings.paths.licenseFile);
    const reproduced: Set<string> = new Set();
    const application = applicationStanza(settings, own, reproduced);

    const stanzas = filePatterns(sections).flatMap((files) =>
        fileStanza({ settings, files, sections: sectionsFor(sections, files), reproduced }));

    return [
        ...headerLines(settings, sections),
        "",
        ...application,
        ...stanzas,
    ].join("\n");
};

export { renderCopyright };
