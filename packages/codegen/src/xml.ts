import { errorMessage, isRecord } from "@gtkx/utils";
import { type X2jOptions, XMLParser } from "fast-xml-parser";
import { SyntaxValidator } from "fast-xml-validator";
import { readFileSync } from "node:fs";

type XmlFileInput = {
    parser: XMLParser;
    label: string;
    path: string;
    malformedRemedy?: string;
};

const HIGHEST_CONTROL_CODE = 0x1F;
const LEGAL_CONTROL_CODES: Set<number> = new Set([0x09, 0x0A, 0x0D]);

const createXmlParser = (options: Partial<X2jOptions>): XMLParser =>
    new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: "@_",
        parseAttributeValue: false,
        parseTagValue: false,
        ...options,
    });

const xmlFileError = (input: XmlFileInput, action: string, error: unknown): Error =>
    new Error(`Cannot ${action} the ${input.label} at ${input.path}: ${errorMessage(error)}`, { cause: error });

const readXmlFile = (input: XmlFileInput): string => {
    try {
        return readFileSync(input.path, "utf8");
    } catch (error) {
        throw xmlFileError(input, "read", error);
    }
};

const isLocated = (line: unknown, col: unknown): boolean =>
    typeof line === "number" && typeof col === "number" && (line > 1 || col > 1);

const positionSuffix = (error: unknown): string => {
    if (!isRecord(error)) {
        return "";
    }

    const { line, col } = error;

    if (!isLocated(line, col)) {
        return "";
    }

    return ` (line ${String(line)}, column ${String(col)})`;
};

const isIllegalControlCode = (code: number): boolean =>
    code <= HIGHEST_CONTROL_CODE && !LEGAL_CONTROL_CODES.has(code);

const escapedCode = (code: number): string => `[U+${code.toString(16).toUpperCase().padStart(4, "0")}]`;

const escapeControlCodes = (text: string): string => {
    let escaped = "";

    for (const character of text) {
        const code = character.codePointAt(0) ?? 0;
        escaped += isIllegalControlCode(code) ? escapedCode(code) : character;
    }

    return escaped;
};

const offendingLine = (xml: string, error: unknown): string => {
    const line = isRecord(error) ? error.line : undefined;

    if (typeof line !== "number") {
        return "";
    }

    const text = xml.split("\n")[line - 1];

    if (text === undefined) {
        return "";
    }

    return `\n    ${escapeControlCodes(text.replace(/^[ \t]+/, "").replace(/\r$/, ""))}`;
};

const remedySuffix = (input: XmlFileInput, xml: string, error: unknown): string => {
    const remedy = input.malformedRemedy;

    return remedy === undefined ? "" : `${offendingLine(xml, error)}\n${remedy}`;
};

const assertWellFormed = (input: XmlFileInput, xml: string): void => {
    try {
        SyntaxValidator.validate(xml);
    } catch (error) {
        throw new Error(
            `The ${input.label} at ${input.path} is not well-formed XML: ` +
            `${errorMessage(error)}${positionSuffix(error)}${remedySuffix(input, xml, error)}`,
            { cause: error },
        );
    }
};

const parseXmlFile = (input: XmlFileInput): unknown => {
    const xml = readXmlFile(input);
    assertWellFormed(input, xml);

    try {
        return input.parser.parse(xml);
    } catch (error) {
        throw xmlFileError(input, "parse", error);
    }
};

export { createXmlParser, parseXmlFile };
