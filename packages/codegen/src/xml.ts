import { errorMessage, isRecord } from "@gtkx/utils";
import { type X2jOptions, XMLParser } from "fast-xml-parser";
import { SyntaxValidator } from "fast-xml-validator";
import { readFileSync } from "node:fs";

type XmlFileInput = {
    parser: XMLParser;
    label: string;
    path: string;
    malformedRemedy?: string;
    preserveIllegalControls?: boolean;
};

type SanitizedXml = {
    source: string;
    replacements: Map<string, string>;
};

const HIGHEST_CONTROL_CODE = 0x1F;
const LEGAL_CONTROL_CODES: Set<number> = new Set([0x09, 0x0A, 0x0D]);
const PRIVATE_USE_START = 0xE0_00;
const PRIVATE_USE_END = 0xF8_FF;
const CONTROL_CODE_RANGE = HIGHEST_CONTROL_CODE + 1;

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

const addCodePoints = (text: string, target: Set<number>): void => {
    for (const character of text) {
        target.add(character.codePointAt(0) ?? 0);
    }
};

const numericEntityCode = (match: RegExpMatchArray): number | undefined => {
    const hexadecimal = match[1];

    if (hexadecimal !== undefined) {
        return Number.parseInt(hexadecimal, 16);
    }

    const decimal = match[2];

    return decimal === undefined ? undefined : Number(decimal);
};

const occupiedCodePoints = (xml: string): Set<number> => {
    const occupied: Set<number> = new Set();
    addCodePoints(xml, occupied);

    for (const match of xml.matchAll(/&#(?:x([\da-f]+)|(\d+));/giu)) {
        const code = numericEntityCode(match);

        if (code !== undefined && Number.isSafeInteger(code) && code >= 0 && code <= 0x10_FF_FF) {
            occupied.add(code);
        }
    }

    return occupied;
};

const privateUseBase = (xml: string): number => {
    const occupied = occupiedCodePoints(xml);

    for (let base = PRIVATE_USE_START; base + HIGHEST_CONTROL_CODE <= PRIVATE_USE_END; base += CONTROL_CODE_RANGE) {
        const isAvailable = Array.from(
            { length: CONTROL_CODE_RANGE },
            (_, code) => base + code,
        ).every((code) => !occupied.has(code));

        if (isAvailable) {
            return base;
        }
    }

    throw new Error(
        "Cannot preserve illegal XML control codes because every private-use replacement range is occupied",
    );
};

const illegalControlCodes = (xml: string): Set<number> => {
    const codes: Set<number> = new Set();

    for (const character of xml) {
        const code = character.codePointAt(0) ?? 0;

        if (isIllegalControlCode(code)) {
            codes.add(code);
        }
    }

    return codes;
};

const replaceControlCodes = (xml: string, base: number): string => {
    let sanitized = "";

    for (const character of xml) {
        const code = character.codePointAt(0) ?? 0;
        sanitized += isIllegalControlCode(code) ? String.fromCodePoint(base + code) : character;
    }

    return sanitized;
};

const sanitizeControlCodes = (xml: string): SanitizedXml => {
    const illegalCodes = illegalControlCodes(xml);

    if (illegalCodes.size === 0) {
        return { source: xml, replacements: new Map() };
    }

    const base = privateUseBase(xml);
    const replacements = new Map(
        [...illegalCodes].map((code) => [String.fromCodePoint(base + code), String.fromCodePoint(code)]),
    );

    return { source: replaceControlCodes(xml, base), replacements };
};

const restoreString = (value: string, replacements: Map<string, string>): string => {
    let restored = value;

    for (const [replacement, control] of replacements) {
        restored = restored.split(replacement).join(control);
    }

    return restored;
};

const restoreControlCodes = (value: unknown, replacements: Map<string, string>): unknown => {
    if (typeof value === "string") {
        return restoreString(value, replacements);
    }

    if (Array.isArray(value)) {
        return value.map((entry) => restoreControlCodes(entry, replacements));
    }

    if (isRecord(value)) {
        return Object.fromEntries(
            Object.entries(value).map(([key, entry]) => [key, restoreControlCodes(entry, replacements)]),
        );
    }

    return value;
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

const assertWellFormed = (input: XmlFileInput, xml: string, displayedXml: string): void => {
    try {
        SyntaxValidator.validate(xml);
    } catch (error) {
        throw new Error(
            `The ${input.label} at ${input.path} is not well-formed XML: ` +
            `${errorMessage(error)}${positionSuffix(error)}${remedySuffix(input, displayedXml, error)}`,
            { cause: error },
        );
    }
};

const parseXmlFile = (input: XmlFileInput): unknown => {
    const xml = readXmlFile(input);
    const sanitized = input.preserveIllegalControls === true
        ? sanitizeControlCodes(xml)
        : { source: xml, replacements: new Map<string, string>() };
    assertWellFormed(input, sanitized.source, xml);

    try {
        return restoreControlCodes(input.parser.parse(sanitized.source), sanitized.replacements);
    } catch (error) {
        throw xmlFileError(input, "parse", error);
    }
};

export { createXmlParser, parseXmlFile };
