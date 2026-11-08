import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { ParameterType, ReflectionKind } from "typedoc";
import { MarkdownPageEvent } from "typedoc-plugin-markdown";

const OPTION = "packageGroups";
const GROUPS_FILE = "typedoc-package-groups.json";
const PACKAGES_TABLE = /^(\| Package \| Description \|\n\|[- |]+\|\n)((?:\|.*(?:\n|$))+)/mu;
const PACKAGE_ROW = /^\| \[([^\]]+)\]/u;

const packageRows = (body) =>
    new Map(
        body
            .split("\n")
            .filter((row) => row !== "")
            .map((row) => [PACKAGE_ROW.exec(row)?.[1] ?? row, row]),
    );

const groupedTables = (header, rows, groups) => {
    const grouped = Object.values(groups).flat();
    const ungrouped = [...rows.keys()].filter((name) => !grouped.includes(name));
    const unknown = grouped.filter((name) => !rows.has(name));

    if (ungrouped.length > 0 || unknown.length > 0) {
        throw new Error(
            `${OPTION} must list each documented package once. Ungrouped: ${ungrouped.join(", ") || "none"}. Unknown: ${unknown.join(", ") || "none"}.`,
        );
    }

    return Object.entries(groups)
        .map(([title, names]) => `### ${title}\n\n${header}${names.map((name) => rows.get(name)).join("\n")}\n`)
        .join("\n");
};

const load = (app) => {
    app.options.addDeclaration({
        defaultValue: {},
        help: "Groups the packages table on the reference index, and the reference sidebar, under the given headings, in the given order.",
        name: OPTION,
        type: ParameterType.Mixed,
    });

    app.renderer.on(MarkdownPageEvent.END, (page) => {
        const groups = app.options.getValue(OPTION);

        if (page.model.kind !== ReflectionKind.Project || Object.keys(groups).length === 0 || !page.contents) {
            return;
        }

        page.contents = page.contents.replace(PACKAGES_TABLE, (_table, header, body) =>
            groupedTables(header, packageRows(body), groups),
        );
    });

    app.renderer.postRenderAsyncJobs.push(async () => {
        const groups = app.options.getValue(OPTION);

        if (Object.keys(groups).length > 0) {
            await writeFile(join(app.options.getValue("out"), GROUPS_FILE), `${JSON.stringify(groups, null, 4)}\n`);
        }
    });
};

export { load };
