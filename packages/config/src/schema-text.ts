import { z } from "zod";

const FILE_EXTENSION = /^[^\s./\\*?[\]]+(?:\.[^\s./\\*?[\]]+)*$/;
const SEGMENT_SEPARATOR = /[/\\]/;

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

const relativePath = (message: string): z.ZodString =>
    z.string({ error: message }).refine((value) => isRelativePath(value), { error: message });

const relativePathRecord = (
    keyMessage: string,
    valueMessage: string,
    recordMessage: string,
): z.ZodRecord<z.ZodString, z.ZodString> =>
    z.record(relativePath(keyMessage), text(valueMessage), { error: recordMessage });

export { fileExtension, flag, relativePathRecord, text, textList, textRecord, url };
