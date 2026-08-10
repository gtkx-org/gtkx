import { z } from "zod";

const text = (message: string): z.ZodString => z.string({ error: message }).min(1, { error: message });

const textList = (itemNoun: string, listMessage: string): z.ZodArray<z.ZodString> =>
    z.array(text(`must be a non-empty ${itemNoun}`), { error: listMessage });

const url = (message: string): z.ZodURL => z.url({ error: message });
const flag = (message: string): z.ZodBoolean => z.boolean({ error: message });

const textRecord = (valueMessage: string, recordMessage: string): z.ZodRecord<z.ZodString, z.ZodString> =>
    z.record(z.string(), text(valueMessage), { error: recordMessage });

export { flag, text, textList, textRecord, url };
