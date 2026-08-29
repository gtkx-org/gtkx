import { z } from "zod";

const FILE_EXTENSION = /^[^\s./\\*?[\]]+(?:\.[^\s./\\*?[\]]+)*$/;
const GIR_LIBRARY = /^[A-Za-z][A-Za-z0-9]*-\d+(?:\.\d+)*$/;
const SEGMENT_SEPARATOR = /[/\\]/;

const isGirLibrary = (value: string): boolean => GIR_LIBRARY.test(value);

const isRelativePath = (value: string): boolean => {
    if (value.length === 0 || value.startsWith("/") || value.includes("\\")) {
        return false;
    }

    return value.split(SEGMENT_SEPARATOR).every((part) => part !== "" && part !== "..");
};

const text = (message: string): z.ZodString => z.string({ error: message }).min(1, { error: message });

const textList = (itemNoun: string, listMessage: string): z.ZodArray<z.ZodString> =>
    z.array(text(`must be a non-empty ${itemNoun}`), { error: listMessage });

const url = (message: string): z.ZodURL => z.url({ error: message });
const flag = (message: string): z.ZodBoolean => z.boolean({ error: message });

const textRecord = (valueMessage: string, recordMessage: string): z.ZodRecord<z.ZodString, z.ZodString> =>
    z.record(z.string(), text(valueMessage), { error: recordMessage });

const fileExtension = (message: string): z.ZodString =>
    z.string({ error: message }).refine((value) => FILE_EXTENSION.test(value), { error: message });

const girLibrary = (message: string): z.ZodString =>
    z.string({ error: message }).refine((value) => isGirLibrary(value), { error: message });

const relativePath = (message: string): z.ZodString =>
    z.string({ error: message }).refine((value) => isRelativePath(value), { error: message });

const relativePathRecord = <Value extends z.ZodType>(
    keyMessage: string,
    value: Value,
    recordMessage: string,
): z.ZodRecord<z.ZodString, Value> => z.record(relativePath(keyMessage), value, { error: recordMessage });

export { fileExtension, flag, girLibrary, relativePathRecord, text, textList, textRecord, url };
