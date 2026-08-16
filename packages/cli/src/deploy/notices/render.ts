import type { DeploySettings, Notice, NoticeSection } from "../types.js";

const RULE_WIDTH = 100;
const HEADING = "THIRD-PARTY NOTICES";
const SECTION_RULE = "=".repeat(RULE_WIDTH);
const NOTICE_RULE = "-".repeat(RULE_WIDTH);
const FILE_SEPARATOR = ", ";

const introFor = (settings: DeploySettings): string[] => [
    HEADING,
    `${settings.name} ${settings.versions.upstream}`,
    "",
    `This file lists the software that ships inside ${settings.name} without having been written by its`,
    "authors, and the terms each piece of it is distributed under.",
];

const headerFor = (section: NoticeSection): string[] => [
    SECTION_RULE,
    section.title,
    ...(section.files.length === 0 ? [] : [`Files: ${section.files.join(FILE_SEPARATOR)}`]),
    SECTION_RULE,
    "",
];

const detailLines = (notice: Notice): string[] => [
    `License: ${notice.license}`,
    ...(notice.source === null ? [] : [`Source: ${notice.source}`]),
];

const bodyLines = (notice: Notice): string[] =>
    notice.text === null ? notice.copyright : ["", notice.text];

const renderNotice = (notice: Notice): string[] => [
    NOTICE_RULE,
    notice.subject,
    ...detailLines(notice),
    NOTICE_RULE,
    ...bodyLines(notice),
    "",
];

const renderSection = (section: NoticeSection): string[] => [
    ...headerFor(section),
    ...section.summary,
    "",
    ...section.notices.flatMap((notice) => renderNotice(notice)),
];

const renderNotices = (settings: DeploySettings, sections: NoticeSection[]): string =>
    [...introFor(settings), "", ...sections.flatMap((section) => renderSection(section)), ""].join("\n");

export { renderNotices };
