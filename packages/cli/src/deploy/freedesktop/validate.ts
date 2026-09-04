import { resolveExecutable, sortStrings, warn } from "@gtkx/utils";
import { spawnSync } from "node:child_process";

type ToolResult = {
    output: string;
    status: number;
};

type Diagnostic = {
    severity: string;
    rule: string;
    detail: string;
};

type MetainfoResult = {
    subject: string;
    output: string;
    status: number;
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

const DIAGNOSTIC = /^(?<severity>[EIPW]): \S+ (?<rule>[\w-]+)(?: (?<detail>.*))?$/;
const SUCCESS_SUMMARY = /^\W*Validation was successful/u;
const ERROR_SEVERITY = "E";
const WARNING_SEVERITY = "W";
const INFO_SEVERITY = "I";
const FATAL_WARNING_RULES: Set<string> = new Set(["unknown-tag"]);

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

    return { output: [result.stdout, result.stderr].join("\n").trim(), status: result.status ?? 0 };
};

const parseDiagnostics = (output: string): Diagnostic[] =>
    output.split("\n").flatMap((line) => {
        const groups = DIAGNOSTIC.exec(line)?.groups;

        return groups === undefined
            ? []
            : [{ severity: groups.severity ?? "", rule: groups.rule ?? "", detail: (groups.detail ?? "").trim() }];
    });

const rulesIn = (diagnostics: Diagnostic[], severities: string[]): string[] =>
    diagnostics.filter((diagnostic) => severities.includes(diagnostic.severity)).map((diagnostic) => diagnostic.rule);

const fatalNotes = (diagnostics: Diagnostic[]): string[] =>
    diagnostics
        .filter((diagnostic) => diagnostic.severity !== ERROR_SEVERITY && FATAL_WARNING_RULES.has(diagnostic.rule))
        .map((diagnostic) =>
            FATAL_RULE_NOTES[diagnostic.rule]?.(diagnostic.detail) ??
            `GTKX treats ${diagnostic.rule} as fatal for every target`);

const withoutSuccessSummary = (output: string): string =>
    output
        .split("\n")
        .filter((line) => !SUCCESS_SUMMARY.test(line))
        .join("\n")
        .trimEnd();

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

    return status !== 0 && warnings.length === 0;
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

    if (status !== 0 || output.length > 0) {
        throw invalid("The desktop entry", output, [], []);
    }
};

const validateMetainfo = (path: string, areWarningsFatal: boolean): void => {
    const subject = "The AppStream metainfo";

    const { output, status } = runTool({
        tool: "appstreamcli",
        args: ["validate", "--no-net", "--explain", path],
        subject,
    });

    const diagnostics = parseDiagnostics(output);
    const errors = rulesIn(diagnostics, [ERROR_SEVERITY]);
    const warnings = rulesIn(diagnostics, [WARNING_SEVERITY]);
    const infos = rulesIn(diagnostics, [INFO_SEVERITY]);
    const rules = [...errors, ...warnings, ...infos];
    const notes = fatalNotes(diagnostics);
    assertNotFatal({
        subject,
        output: withoutSuccessSummary(output),
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
