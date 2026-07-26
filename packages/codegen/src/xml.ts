import { type X2jOptions, XMLParser } from "fast-xml-parser";

const createXmlParser = (options: Partial<X2jOptions>): XMLParser =>
    new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: "@_",
        parseAttributeValue: false,
        parseTagValue: false,
        ...options,
    });

export { createXmlParser };
