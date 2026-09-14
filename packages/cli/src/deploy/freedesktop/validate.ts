import { resolveExecutable, sortStrings, warn } from "@gtkx/utils";
import { spawnSync } from "node:child_process";
import { parse } from "yaml";

type ToolResult = {
    output: string;
    stdout: string;
    status: number | null;
};

type Diagnostic = {
    severity: string;
    tag: string;
    hint?: string;
    explanation: string;
};

type MetainfoResult = {
    subject: string;
    output: string;
    status: number | null;
    errors: string[];
    warnings: string[];
    rules: string[];
    notes: string[];
    areWarningsFatal: boolean;
};

type ToolRequest = {
    tool: string;
    args: string[];
    subject: string;
};

const ERROR_SEVERITY = "error";
const WARNING_SEVERITY = "warning";
const INFO_SEVERITY = "info";
const FATAL_WARNING_RULES: Set<string> = new Set(["unknown-tag"]);
const DESKTOP_ERROR = /(?:^|:\s)error:/iu;

const FATAL_RULE_NOTES: Record<string, (detail: string) => string> = {
    "unknown-tag": (element) =>
        "GTKX treats unknown-tag as fatal for every target, whatever severity appstreamcli assigns it; " +
        `the unsupported element is <${element}>`,
};

const REMEDY_FOR_RULE: Record<string, string> = {
    "component-summary-missing": "set `deploy.summary`",
    "description-first-para-too-short": "open `deploy.description` with a paragraph longer than 80 characters",
    "developer-info-missing": "set `deploy.developer.name`",
    "metainfo-legacy-path": "this file is generated; report it as a gtkx bug",
    "summary-has-dot-suffix": "drop the trailing period from `deploy.summary`",
    "summary-too-long": "shorten `deploy.summary`",
    "unknown-tag": "remove the unsupported `deploy.metainfoExtra` element or use a `<custom>` value",
    "url-homepage-missing": "set `deploy.homepage`, or `homepage` in package.json",
};

const runTool = ({ tool, args, subject }: ToolRequest): ToolResult => {
    const result = spawnSync(resolveExecutable(tool), args, { encoding: "utf8" });

    if (result.error !== undefined) {
        throw new Error(`${subject} could not be validated: ${result.error.message}`, { cause: result.error });
    }

    return {
        output: [result.stdout, result.stderr].join("\n").trim(),
        stdout: result.stdout,
        status: result.status,
    };
};

const rulesIn = (diagnostics: Diagnostic[], severities: string[]): string[] =>
    diagnostics.filter((diagnostic) => severities.includes(diagnostic.severity)).map((diagnostic) => diagnostic.tag);

const fatalNotes = (diagnostics: Diagnostic[]): string[] =>
    diagnostics
        .filter((diagnostic) => diagnostic.severity !== ERROR_SEVERITY && FATAL_WARNING_RULES.has(diagnostic.tag))
        .map((diagnostic) =>
            FATAL_RULE_NOTES[diagnostic.tag]?.(diagnostic.hint ?? "") ??
            `GTKX treats ${diagnostic.tag} as fatal for every target`);

const remedyLines = (rules: string[]): string[] => {
    const remedies = sortStrings([...new Set(rules)])
        .filter((rule) => REMEDY_FOR_RULE[rule] !== undefined)
        .map((rule) => `  ${rule}: ${REMEDY_FOR_RULE[rule] ?? ""}`);

    return remedies.length === 0 ? [] : ["", "Fix it in gtkx.config.ts:", ...remedies];
};

const invalid = (subject: string, output: string, rules: string[], notes: string[]): Error =>
    new Error([
        `${subject} is not valid:`,
        output.length > 0 ? output : "no output",
        ...notes,
        ...remedyLines(rules),
    ].join("\n"));

const isFatalResult = ({ status, errors, warnings, rules, areWarningsFatal }: MetainfoResult): boolean => {
    if (errors.length > 0) {
        return true;
    }

    if (rules.some((rule) => FATAL_WARNING_RULES.has(rule))) {
        return true;
    }

    if (areWarningsFatal && warnings.length > 0) {
        return true;
    }

    return status === null || (status !== 0 && warnings.length === 0);
};

const assertNotFatal = (result: MetainfoResult): void => {
    if (isFatalResult(result)) {
        throw invalid(result.subject, result.output, result.rules, result.notes);
    }
};

const describeRule = (rule: string): string => {
    const remedy = REMEDY_FOR_RULE[rule];

    return remedy === undefined ? rule : `${rule} — ${remedy}`;
};

const reportDiagnostics = (subject: string, rules: string[]): void => {
    for (const rule of rules) {
        warn(`${subject}: ${describeRule(rule)}`);
    }
};

const validateDesktopEntry = (path: string): void => {
    const { output, status } = runTool({
        tool: "desktop-file-validate",
        args: [path],
        subject: "The desktop entry",
    });

    const diagnostics = output.split("\n").filter((line) => line.length > 0);

    if (status !== 0 || diagnostics.some((line) => DESKTOP_ERROR.test(line))) {
        throw invalid("The desktop entry", output, [], []);
    }

    for (const diagnostic of diagnostics) {
        warn(diagnostic);
    }
};

const validateMetainfo = (path: string, areWarningsFatal: boolean): void => {
    const subject = "The AppStream metainfo";

    const { output, stdout, status } = runTool({
        tool: "appstreamcli",
        args: ["validate", "--no-net", "--format=yaml", path],
        subject,
    });

    const report = parse(stdout) as { Issues: Diagnostic[] } | null;
    const diagnostics = report?.Issues ?? [];
    const errors = rulesIn(diagnostics, [ERROR_SEVERITY]);
    const warnings = rulesIn(diagnostics, [WARNING_SEVERITY]);
    const infos = rulesIn(diagnostics, [INFO_SEVERITY]);
    const rules = [...errors, ...warnings, ...infos];
    const notes = fatalNotes(diagnostics);
    assertNotFatal({
        subject,
        output: diagnostics.length === 0
            ? output
            : diagnostics.map((issue) => `${issue.tag}: ${issue.explanation}`).join("\n"),
        status,
        errors,
        warnings,
        rules,
        notes,
        areWarningsFatal,
    });
    reportDiagnostics(subject, [...warnings, ...infos]);
};

export { validateDesktopEntry, validateMetainfo };
