import { resolveExecutable, sortStrings, warn } from "@gtkx/utils";
import { spawnSync } from "node:child_process";

type ToolResult = {
    output: string;
    status: number;
};

type MetainfoResult = {
    subject: string;
    output: string;
    status: number;
    errors: string[];
    warnings: string[];
    rules: string[];
    areWarningsFatal: boolean;
};

type ToolRequest = {
    tool: string;
    args: string[];
    subject: string;
};

const DIAGNOSTIC = /^(?<severity>[EIPW]): \S+ (?<rule>[\w-]+)/;
const ERROR_SEVERITY = "E";
const WARNING_SEVERITY = "W";
const INFO_SEVERITY = "I";
const FATAL_WARNING_RULES: Set<string> = new Set(["unknown-tag"]);

const REMEDY_FOR_RULE: Record<string, string> = {
    "component-summary-missing": "set `deploy.summary`",
    "description-first-para-too-short": "open `deploy.description` with a paragraph longer than 80 characters",
    "developer-info-missing": "set `deploy.developer.name`",
    "metainfo-legacy-path": "this file is generated; report it as a gtkx bug",
    "summary-has-dot-suffix": "drop the trailing period from `deploy.summary`",
    "summary-too-long": "shorten `deploy.summary`",
    "url-homepage-missing": "set `deploy.homepage`, or `homepage` in package.json",
};

const runTool = ({ tool, args, subject }: ToolRequest): ToolResult => {
    const result = spawnSync(resolveExecutable(tool), args, { encoding: "utf8" });

    if (result.error !== undefined) {
        throw new Error(`${subject} could not be validated: ${result.error.message}`, { cause: result.error });
    }

    return { output: [result.stdout, result.stderr].join("\n").trim(), status: result.status ?? 0 };
};

const rulesIn = (output: string, severities: string[]): string[] =>
    output
        .split("\n")
        .map((line) => DIAGNOSTIC.exec(line)?.groups)
        .filter((groups) => groups !== undefined && severities.includes(groups.severity ?? ""))
        .map((groups) => groups?.rule ?? "");

const remedyLines = (rules: string[]): string[] => {
    const remedies = sortStrings([...new Set(rules)])
        .filter((rule) => REMEDY_FOR_RULE[rule] !== undefined)
        .map((rule) => `  ${rule}: ${REMEDY_FOR_RULE[rule] ?? ""}`);

    return remedies.length === 0 ? [] : ["", "Fix it in gtkx.config.ts:", ...remedies];
};

const invalid = (subject: string, output: string, rules: string[]): Error =>
    new Error([`${subject} is not valid:`, output.length > 0 ? output : "no output", ...remedyLines(rules)].join("\n"));

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
        throw invalid(result.subject, result.output, result.rules);
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
        throw invalid("The desktop entry", output, []);
    }
};

const validateMetainfo = (path: string, areWarningsFatal: boolean): void => {
    const subject = "The AppStream metainfo";

    const { output, status } = runTool({
        tool: "appstreamcli",
        args: ["validate", "--no-net", "--explain", path],
        subject,
    });

    const errors = rulesIn(output, [ERROR_SEVERITY]);
    const warnings = rulesIn(output, [WARNING_SEVERITY]);
    const infos = rulesIn(output, [INFO_SEVERITY]);
    const rules = [...errors, ...warnings, ...infos];
    assertNotFatal({ subject, output, status, errors, warnings, rules, areWarningsFatal });
    reportDiagnostics(subject, [...warnings, ...infos]);
};

export { validateDesktopEntry, validateMetainfo };
