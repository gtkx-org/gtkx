import { errorMessage, isRecord } from "@gtkx/utils";
import { type X2jOptions, XMLParser } from "fast-xml-parser";
import { SyntaxValidator } from "fast-xml-validator";
import { readFileSync } from "node:fs";

type XmlFileInput = {
    parser: XMLParser;
    label: string;
    path: string;
};

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

const assertWellFormed = (input: XmlFileInput, xml: string): void => {
    try {
        SyntaxValidator.validate(xml);
    } catch (error) {
        throw new Error(
            `The ${input.label} at ${input.path} is not well-formed XML: ` +
            `${errorMessage(error)}${positionSuffix(error)}`,
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
