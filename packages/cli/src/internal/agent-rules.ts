import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { REFERENCE_PATH } from "../codegen/reference.js";

type AgentRulesResult = {
    isWritten: boolean;
    files: string[];
};

const AGENTS_FILENAME = "AGENTS.md";
const CLAUDE_FILENAME = "CLAUDE.md";
const CLAUDE_CONTENTS = `@${AGENTS_FILENAME}\n`;
const BEGIN_MARKER = "<!-- BEGIN:gtkx-agent-rules -->";
const END_MARKER = "<!-- END:gtkx-agent-rules -->";
const BLOCK_PATTERN = /<!-- BEGIN:gtkx-agent-rules -->[\s\S]*?<!-- END:gtkx-agent-rules -->/;
const TOP_LEVEL_HEADING = /^# /m;

const rulesBody = (heading: string): string[] => [
    `${heading} GTKX`,
    "",
    "GTKX applications are Adwaita-first, with GTK4 underneath. Most GNOME UI code in your training data is C, " +
    "PyGObject, Vala or GJS, and almost none of it is valid here. Check the rules below against what you are " +
    "about to write.",
    "",
    "- Start application shells with `AdwApplication` and `AdwApplicationWindow`. Freeform windows normally use " +
    "`AdwToolbarView` and `AdwHeaderBar`; navigation containers own their Adwaita chrome. Prefer Adwaita for " +
    "structure, navigation, dialogs, rows, and adaptive patterns; use GTK4 for lower-level primitives.",
    "- Children are JSX, never `.append()`, `pack_start()`, `set_child()` or `add()`.",
    '- Signals are props: `onClicked`, not `widget.connect("clicked", ...)`.',
    "- Props are camelCase: `marginTop`, not `margin-top` or `margin_top`.",
    "- There is no `Gtk.Template`, no `.ui` XML, and no `GtkBuilder`. The JSX tree is the definition.",
    "- Elements come from `@gtkx/jsx/<namespace>` and classes, enums and functions from " +
    "`@gtkx/gi/<namespace>`. Both are generated for this project by `gtkx codegen`, not installed from npm, " +
    "so they match the GIR libraries this project declares.",
    "",
    `Read \`${REFERENCE_PATH}/index.md\` before writing widget code. It is generated from this project's own ` +
    "GIR libraries and is the authority on which props, signals and methods exist. Do not infer a prop from " +
    "another toolkit, from a C function name, or from a similar element.",
    "",
    "| Command | What it does |",
    "| --- | --- |",
    "| `gtkx dev` | Run the app with fast refresh |",
    "| `gtkx codegen` | Regenerate bindings and this reference |",
    "| `gtkx cleanup` | Remove stale headless runtime directories |",
    "| `tsc --noEmit` | Typecheck |",
    "| `vitest run` | Run the tests |",
    "",
    "Never call UI work done without looking at the running app. With `gtkx dev` up, the gtkx MCP server " +
    "exposes the live widget tree, queries, clicks and screenshots; use them to confirm the change landed.",
    "",
    "This block is written by `gtkx codegen`. Anything outside the markers is yours and is left alone, and " +
    "committing the block with your work keeps the tree clean.",
];

const renderBlock = (heading: string): string =>
    [BEGIN_MARKER, "", ...rulesBody(heading), "", END_MARKER].join("\n");

const headingFor = (contents: string): string => (TOP_LEVEL_HEADING.test(contents) ? "##" : "#");
const withTrailingNewline = (contents: string): string => (contents.endsWith("\n") ? contents : `${contents}\n`);

const appendBlock = (contents: string, block: string): string => {
    if (contents.trim() === "") {
        return `${block}\n`;
    }

    return `${withTrailingNewline(contents)}\n${block}\n`;
};

const replaceBlock = (contents: string, block: string): string => {
    const match = BLOCK_PATTERN.exec(contents);

    if (match === null) {
        return appendBlock(contents, block);
    }

    return contents.slice(0, match.index) + block + contents.slice(match.index + match[0].length);
};

const nextContents = (contents: string): string => {
    const heading = headingFor(contents.replace(BLOCK_PATTERN, ""));

    return replaceBlock(contents, renderBlock(heading));
};

const errorCode = (error: unknown): string | undefined =>
    error instanceof Error ? (error as NodeJS.ErrnoException).code : undefined;

const readOrUndefined = (path: string): string | undefined => {
    try {
        return readFileSync(path, "utf8");
    } catch (error) {
        if (errorCode(error) === "ENOENT") {
            return undefined;
        }

        throw error;
    }
};

const hasWritten = (path: string, contents: string): boolean => {
    if (readOrUndefined(path) === contents) {
        return false;
    }

    writeFileSync(path, contents);

    return true;
};

const hasWrittenClaudeImport = (root: string): boolean => {
    try {
        writeFileSync(join(root, CLAUDE_FILENAME), CLAUDE_CONTENTS, { flag: "wx" });

        return true;
    } catch (error) {
        if (errorCode(error) === "EEXIST") {
            return false;
        }

        throw error;
    }
};

const upsertAgentRules = (root: string): AgentRulesResult => {
    const agentsPath = join(root, AGENTS_FILENAME);
    const existing = readOrUndefined(agentsPath) ?? "";
    const files: string[] = [];

    if (hasWritten(agentsPath, nextContents(existing))) {
        files.push(AGENTS_FILENAME);
    }

    if (hasWrittenClaudeImport(root)) {
        files.push(CLAUDE_FILENAME);
    }

    return { isWritten: files.length > 0, files };
};

export { upsertAgentRules };
