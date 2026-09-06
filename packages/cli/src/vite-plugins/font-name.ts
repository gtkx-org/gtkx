import { brotliDecompressSync, inflateSync } from "node:zlib";

type Base128 = {
    offset: number;
    value: number;
};

type NameHeader = {
    encodingId: number;
    languageId: number;
    length: number;
    nameId: number;
    platformId: number;
    stringOffset: number;
};

type NameRecord = NameHeader & { value: string };

type ScoredName = {
    score: number;
    value: string;
};

type Woff2Entry = {
    length: number;
    next: number;
    tag: string;
};

type Woff2Table = {
    length: number;
    offset: number;
    tag: string;
};

type Woff2Directory = {
    end: number;
    tables: Woff2Table[];
};

type Woff2Step = (data: Buffer, offset: number) => number | undefined;

const MAX_FONT_BYTES = 256 * 1024 * 1024;
const MAX_TABLE_BYTES = 16 * 1024 * 1024;
const TAG_SIZE = 4;
const TAG_GLYF = "glyf";
const TAG_LOCA = "loca";
const TAG_NAME = "name";
const TAG_TTCF = "ttcf";
const SIGNATURE_WOFF = "wOFF";
const SIGNATURE_WOFF2 = "wOF2";
const SFNT_VERSION_COLLECTION = 0x74_74_63_66;
const SFNT_VERSIONS = new Set([0x00_01_00_00, 0x4F_54_54_4F, 0x74_72_75_65]);
const SFNT_TABLE_COUNT_OFFSET = 4;
const SFNT_DIRECTORY_OFFSET = 12;
const SFNT_RECORD_SIZE = 16;
const SFNT_RECORD_OFFSET_FIELD = 8;
const SFNT_RECORD_LENGTH_FIELD = 12;
const COLLECTION_COUNT_OFFSET = 8;
const COLLECTION_DIRECTORY_OFFSET = 12;
const COLLECTION_ENTRY_SIZE = 4;
const WOFF_TABLE_COUNT_OFFSET = 12;
const WOFF_DIRECTORY_OFFSET = 44;
const WOFF_RECORD_SIZE = 20;
const WOFF_RECORD_OFFSET_FIELD = 4;
const WOFF_RECORD_COMPRESSED_FIELD = 8;
const WOFF_RECORD_ORIGINAL_FIELD = 12;
const WOFF2_FLAVOR_OFFSET = 4;
const WOFF2_TABLE_COUNT_OFFSET = 12;
const WOFF2_COMPRESSED_SIZE_OFFSET = 20;
const WOFF2_HEADER_SIZE = 48;
const WOFF2_COLLECTION_FONTS_OFFSET = 4;
const WOFF2_COLLECTION_FLAVOR_SIZE = 4;
const WOFF2_TAG_MASK = 0x3F;
const WOFF2_TAG_ESCAPE = 63;
const WOFF2_TRANSFORM_SHIFT = 6;
const WOFF2_KNOWN_TAGS = [
    "cmap", "head", "hhea", "hmtx", "maxp", "name", "OS/2", "post", "cvt ", "fpgm",
    "glyf", "loca", "prep", "CFF ", "VORG", "EBDT", "EBLC", "gasp", "hdmx", "kern",
    "LTSH", "PCLT", "VDMX", "vhea", "vmtx", "BASE", "GDEF", "GPOS", "GSUB", "EBSC",
    "JSTF", "MATH", "CBDT", "CBLC", "COLR", "CPAL", "SVG ", "sbix", "acnt", "avar",
    "bdat", "bloc", "bsln", "cvar", "fdsc", "feat", "fmtx", "fvar", "gvar", "hsty",
    "just", "lcar", "mort", "morx", "opbd", "prop", "trak", "Zapf", "Silf", "Glat",
    "Gloc", "Feat", "Sill",
];
const BASE128_MAX_BYTES = 5;
const BASE128_MASK = 0x7F;
const BASE128_RADIX = 128;
const BASE128_CONTINUATION = 0x80;
const UINT32_MAX = 0xFF_FF_FF_FF;
const WORD_CODE = 253;
const EXTENDED_CODES = new Map([[254, 506], [255, 253]]);
const NAME_FORMATS = new Set([0, 1]);
const NAME_HEADER_SIZE = 6;
const NAME_RECORD_SIZE = 12;
const NAME_COUNT_OFFSET = 2;
const NAME_STORAGE_OFFSET = 4;
const FAMILY_NAME_IDS = [21, 16, 1];
const PLATFORM_UNICODE = 0;
const PLATFORM_MACINTOSH = 1;
const PLATFORM_WINDOWS = 3;
const WINDOWS_UTF16_ENCODINGS = new Set([1, 10]);
const MAC_ROMAN_ENCODING = 0;
const MAC_ROMAN_LANGUAGE = 0;
const MAC_ROMAN_HIGH_START = 128;
const MAC_ROMAN_HIGH =
    "ÄÅÇÉÑÖÜáàâäãåçéèêëíìîïñóòôöõúùûü" +
    "†°¢£§•¶ß®©™´¨≠ÆØ∞±≤≥¥µ∂∑∏π∫ªºΩæø" +
    "¿¡¬√ƒ≈∆«»…\u{A0}ÀÃÕŒœ–—“”‘’÷◊ÿŸ⁄€‹›ﬁﬂ" +
    "‡·‚„‰ÂÊÁËÈÍÎÏÌÓÔ\u{F8FF}ÒÚÛÙıˆ˜¯˘˙˚¸˝˛ˇ";
const LANGUAGE_ENGLISH_US = 0x04_09;
const LANGUAGE_ENGLISH = 0x09;
const LANGUAGE_PRIMARY_MASK = 0x03_FF;
const SCORE_WINDOWS_ENGLISH_US = 100;
const SCORE_WINDOWS_ENGLISH = 90;
const SCORE_UNICODE = 80;
const SCORE_MAC_ROMAN = 70;
const SCORE_WINDOWS_OTHER = 10;
const SCORE_NONE = 0;
const CONTROL_PATTERN = /\p{Cc}/gu;

const isValidRange = (data: Buffer, start: number, length: number): boolean =>
    Number.isSafeInteger(start) && Number.isSafeInteger(length) && start >= 0 && length >= 0 &&
    start + length <= data.length;

const sliceRange = (data: Buffer, start: number, length: number): Buffer | undefined =>
    isValidRange(data, start, length) ? data.subarray(start, start + length) : undefined;

const readUint16 = (data: Buffer, offset: number): number | undefined =>
    sliceRange(data, offset, 2)?.readUInt16BE(0);

const readUint32 = (data: Buffer, offset: number): number | undefined =>
    sliceRange(data, offset, 4)?.readUInt32BE(0);

const readTag = (data: Buffer, offset: number): string | undefined =>
    sliceRange(data, offset, TAG_SIZE)?.toString("latin1");

const inflateTable = (data: Buffer, limit: number): Buffer | undefined => {
    try {
        return inflateSync(data, { maxOutputLength: Math.min(limit, MAX_TABLE_BYTES) });
    } catch {
        return undefined;
    }
};

const brotliFont = (data: Buffer): Buffer | undefined => {
    try {
        return brotliDecompressSync(data, { maxOutputLength: MAX_FONT_BYTES });
    } catch {
        return undefined;
    }
};

const macRomanChar = (byte: number): string => {
    const code = byte < MAC_ROMAN_HIGH_START ? byte : MAC_ROMAN_HIGH.codePointAt(byte - MAC_ROMAN_HIGH_START);

    return code === undefined ? "" : String.fromCodePoint(code);
};

const decodeMacRoman = (bytes: Buffer): string => [...bytes].map((byte) => macRomanChar(byte)).join("");

const decodeUtf16 = (bytes: Buffer): string | undefined => {
    if (bytes.length % 2 !== 0) {
        return undefined;
    }

    const swapped = Buffer.from(bytes);

    swapped.swap16();

    return swapped.toString("utf16le");
};

const isUtf16Name = (header: NameHeader): boolean =>
    header.platformId === PLATFORM_UNICODE ||
    (header.platformId === PLATFORM_WINDOWS && WINDOWS_UTF16_ENCODINGS.has(header.encodingId));

const isMacRomanName = (header: NameHeader): boolean =>
    header.platformId === PLATFORM_MACINTOSH &&
    header.encodingId === MAC_ROMAN_ENCODING &&
    header.languageId === MAC_ROMAN_LANGUAGE;

const decodeName = (bytes: Buffer, header: NameHeader): string | undefined => {
    if (isUtf16Name(header)) {
        return decodeUtf16(bytes);
    }

    return isMacRomanName(header) ? decodeMacRoman(bytes) : undefined;
};

const nameRecordHeader = (table: Buffer, offset: number): NameHeader | undefined => {
    const record = sliceRange(table, offset, NAME_RECORD_SIZE);

    if (record === undefined) {
        return undefined;
    }

    return {
        encodingId: record.readUInt16BE(2),
        languageId: record.readUInt16BE(4),
        length: record.readUInt16BE(8),
        nameId: record.readUInt16BE(6),
        platformId: record.readUInt16BE(0),
        stringOffset: record.readUInt16BE(10),
    };
};

const nameRecordAt = (table: Buffer, offset: number, storage: number): NameRecord | undefined => {
    const header = nameRecordHeader(table, offset);

    if (header === undefined) {
        return undefined;
    }

    const bytes = sliceRange(table, storage + header.stringOffset, header.length);
    const decoded = bytes === undefined ? undefined : decodeName(bytes, header);
    const value = decoded?.replaceAll(CONTROL_PATTERN, "").trim();

    return value === undefined || value.length === 0 ? undefined : { ...header, value };
};

const nameRecords = (table: Buffer): NameRecord[] => {
    const format = readUint16(table, 0);
    const count = readUint16(table, NAME_COUNT_OFFSET);
    const storage = readUint16(table, NAME_STORAGE_OFFSET);
    const records: NameRecord[] = [];

    if (format === undefined || count === undefined || storage === undefined || !NAME_FORMATS.has(format)) {
        return records;
    }

    for (let index = 0; index < count; index += 1) {
        const record = nameRecordAt(table, NAME_HEADER_SIZE + index * NAME_RECORD_SIZE, storage);

        if (record !== undefined) {
            records.push(record);
        }
    }

    return records;
};

const windowsLanguageScore = (languageId: number): number => {
    if (languageId === LANGUAGE_ENGLISH_US) {
        return SCORE_WINDOWS_ENGLISH_US;
    }

    return (languageId & LANGUAGE_PRIMARY_MASK) === LANGUAGE_ENGLISH ? SCORE_WINDOWS_ENGLISH : SCORE_WINDOWS_OTHER;
};

const nameScore = (record: NameRecord): number => {
    if (record.platformId === PLATFORM_WINDOWS && WINDOWS_UTF16_ENCODINGS.has(record.encodingId)) {
        return windowsLanguageScore(record.languageId);
    }

    if (record.platformId === PLATFORM_UNICODE) {
        return SCORE_UNICODE;
    }

    return isMacRomanName(record) ? SCORE_MAC_ROMAN : SCORE_NONE;
};

const scoredNames = (records: NameRecord[], nameId: number): ScoredName[] =>
    records
        .filter((record) => record.nameId === nameId)
        .map((record) => ({ score: nameScore(record), value: record.value }))
        .filter((entry) => entry.score > SCORE_NONE);

const bestName = (records: NameRecord[], nameId: number): string | undefined =>
    scoredNames(records, nameId).toSorted((left, right) => right.score - left.score)[0]?.value;

const familyName = (table: Buffer): string | undefined => {
    const records = nameRecords(table);

    return FAMILY_NAME_IDS.map((nameId) => bestName(records, nameId)).find((value) => value !== undefined);
};

const sfntTableAt = (data: Buffer, record: number): Buffer | undefined => {
    const tag = readTag(data, record);
    const offset = readUint32(data, record + SFNT_RECORD_OFFSET_FIELD);
    const length = readUint32(data, record + SFNT_RECORD_LENGTH_FIELD);

    if (tag !== TAG_NAME || offset === undefined || length === undefined) {
        return undefined;
    }

    return sliceRange(data, offset, length);
};

const sfntNameTable = (data: Buffer, start: number): Buffer | undefined => {
    const version = readUint32(data, start);
    const count = readUint16(data, start + SFNT_TABLE_COUNT_OFFSET);

    if (version === undefined || count === undefined || !SFNT_VERSIONS.has(version)) {
        return undefined;
    }

    for (let index = 0; index < count; index += 1) {
        const table = sfntTableAt(data, start + SFNT_DIRECTORY_OFFSET + index * SFNT_RECORD_SIZE);

        if (table !== undefined) {
            return table;
        }
    }

    return undefined;
};

const sfntNameTables = (data: Buffer): Buffer[] => {
    const table = sfntNameTable(data, 0);

    return table === undefined ? [] : [table];
};

const collectionNameTables = (data: Buffer): Buffer[] => {
    const count = readUint32(data, COLLECTION_COUNT_OFFSET) ?? 0;
    const limit = Math.floor((data.length - COLLECTION_DIRECTORY_OFFSET) / COLLECTION_ENTRY_SIZE);
    const tables: Buffer[] = [];

    for (let index = 0; index < Math.min(count, limit); index += 1) {
        const start = readUint32(data, COLLECTION_DIRECTORY_OFFSET + index * COLLECTION_ENTRY_SIZE);
        const table = start === undefined ? undefined : sfntNameTable(data, start);

        if (table !== undefined) {
            tables.push(table);
        }
    }

    return tables;
};

const woffTableData = (compressed: Buffer, compressedLength: number, originalLength: number): Buffer | undefined =>
    compressedLength === originalLength ? compressed : inflateTable(compressed, originalLength);

const woffTableAt = (data: Buffer, record: number): Buffer | undefined => {
    const tag = readTag(data, record);
    const offset = readUint32(data, record + WOFF_RECORD_OFFSET_FIELD);
    const compressedLength = readUint32(data, record + WOFF_RECORD_COMPRESSED_FIELD);
    const originalLength = readUint32(data, record + WOFF_RECORD_ORIGINAL_FIELD);

    if (tag !== TAG_NAME || offset === undefined || compressedLength === undefined || originalLength === undefined) {
        return undefined;
    }

    const compressed = sliceRange(data, offset, compressedLength);

    return compressed === undefined ? undefined : woffTableData(compressed, compressedLength, originalLength);
};

const woffNameTables = (data: Buffer): Buffer[] => {
    const count = readUint16(data, WOFF_TABLE_COUNT_OFFSET) ?? 0;
    const tables: Buffer[] = [];

    for (let index = 0; index < count; index += 1) {
        const table = woffTableAt(data, WOFF_DIRECTORY_OFFSET + index * WOFF_RECORD_SIZE);

        if (table !== undefined) {
            tables.push(table);
        }
    }

    return tables;
};

const base128Length = (data: Buffer, start: number): number | undefined => {
    const window = data.subarray(start, start + BASE128_MAX_BYTES);
    const terminator = window.findIndex((byte) => (byte & BASE128_CONTINUATION) === 0);

    return terminator === -1 ? undefined : terminator + 1;
};

const base128Value = (data: Buffer, start: number, length: number): number => {
    const bytes = data.subarray(start, start + length);
    let value = 0;

    for (const byte of bytes) {
        value = value * BASE128_RADIX + (byte & BASE128_MASK);
    }

    return value;
};

const readBase128 = (data: Buffer, start: number): Base128 | undefined => {
    const length = base128Length(data, start);

    if (length === undefined || data[start] === BASE128_CONTINUATION) {
        return undefined;
    }

    const value = base128Value(data, start, length);

    return value > UINT32_MAX ? undefined : { offset: start + length, value };
};

const readExtended255 = (data: Buffer, start: number, code: number): Base128 | undefined => {
    const extra = EXTENDED_CODES.get(code);

    if (extra === undefined) {
        return { offset: start + 1, value: code };
    }

    const byte = data[start + 1];

    return byte === undefined ? undefined : { offset: start + 2, value: byte + extra };
};

const read255Uint16 = (data: Buffer, start: number): Base128 | undefined => {
    const code = data[start];

    if (code === undefined) {
        return undefined;
    }

    if (code !== WORD_CODE) {
        return readExtended255(data, start, code);
    }

    const value = readUint16(data, start + 1);

    return value === undefined ? undefined : { offset: start + 3, value };
};

const woff2Tag = (data: Buffer, start: number, flags: number): string | undefined =>
    (flags & WOFF2_TAG_MASK) === WOFF2_TAG_ESCAPE
        ? readTag(data, start + 1)
        : WOFF2_KNOWN_TAGS[flags & WOFF2_TAG_MASK];

const woff2TagEnd = (start: number, flags: number): number =>
    (flags & WOFF2_TAG_MASK) === WOFF2_TAG_ESCAPE ? start + 1 + TAG_SIZE : start + 1;

const isWoff2Transformed = (tag: string, flags: number): boolean =>
    tag === TAG_GLYF || tag === TAG_LOCA
        ? (flags >> WOFF2_TRANSFORM_SHIFT) === 0
        : (flags >> WOFF2_TRANSFORM_SHIFT) !== 0;

const woff2TransformedEntry = (data: Buffer, tag: string, original: Base128): Woff2Entry | undefined => {
    const transformed = readBase128(data, original.offset);

    return transformed === undefined ? undefined : { length: transformed.value, next: transformed.offset, tag };
};

const woff2Entry = (data: Buffer, start: number): Woff2Entry | undefined => {
    const flags = data[start];

    if (flags === undefined) {
        return undefined;
    }

    const tag = woff2Tag(data, start, flags);
    const original = readBase128(data, woff2TagEnd(start, flags));

    if (tag === undefined || original === undefined) {
        return undefined;
    }

    return isWoff2Transformed(tag, flags)
        ? woff2TransformedEntry(data, tag, original)
        : { length: original.value, next: original.offset, tag };
};

const woff2Directory = (data: Buffer, count: number): Woff2Directory | undefined => {
    const tables: Woff2Table[] = [];
    let cursor = WOFF2_HEADER_SIZE;
    let offset = 0;

    for (let index = 0; index < count; index += 1) {
        const entry = woff2Entry(data, cursor);

        if (entry === undefined) {
            return undefined;
        }

        tables.push({ length: entry.length, offset, tag: entry.tag });
        cursor = entry.next;
        offset += entry.length;
    }

    return { end: cursor, tables };
};

const skipSequence = (data: Buffer, start: number, count: number, step: Woff2Step): number | undefined => {
    let cursor = start;

    for (let index = 0; index < count; index += 1) {
        const next = step(data, cursor);

        if (next === undefined) {
            return undefined;
        }

        cursor = next;
    }

    return cursor;
};

const skipIndex = (data: Buffer, offset: number): number | undefined => read255Uint16(data, offset)?.offset;

const skipCollectionFont = (data: Buffer, start: number): number | undefined => {
    const tables = read255Uint16(data, start);

    if (tables === undefined) {
        return undefined;
    }

    return skipSequence(data, tables.offset + WOFF2_COLLECTION_FLAVOR_SIZE, tables.value, skipIndex);
};

const woff2CollectionEnd = (data: Buffer, start: number): number | undefined => {
    const fonts = read255Uint16(data, start + WOFF2_COLLECTION_FONTS_OFFSET);

    if (fonts === undefined) {
        return undefined;
    }

    return skipSequence(data, fonts.offset, fonts.value, skipCollectionFont);
};

const woff2DataStart = (data: Buffer, end: number): number | undefined => {
    const flavor = readUint32(data, WOFF2_FLAVOR_OFFSET);

    return flavor === SFNT_VERSION_COLLECTION ? woff2CollectionEnd(data, end) : end;
};

const woff2Compressed = (data: Buffer, start: number): Buffer => {
    const size = readUint32(data, WOFF2_COMPRESSED_SIZE_OFFSET);
    const bounded = size === undefined ? undefined : sliceRange(data, start, size);

    return bounded ?? data.subarray(start);
};

const woff2NameSlices = (font: Buffer, tables: Woff2Table[]): Buffer[] =>
    tables
        .filter((table) => table.tag === TAG_NAME)
        .map((table) => sliceRange(font, table.offset, table.length))
        .filter((table) => table !== undefined);

const woff2Tables = (data: Buffer, directory: Woff2Directory): Buffer[] => {
    const start = woff2DataStart(data, directory.end);
    const font = start === undefined ? undefined : brotliFont(woff2Compressed(data, start));

    return font === undefined ? [] : woff2NameSlices(font, directory.tables);
};

const woff2NameTables = (data: Buffer): Buffer[] => {
    const count = readUint16(data, WOFF2_TABLE_COUNT_OFFSET);
    const directory = count === undefined ? undefined : woff2Directory(data, count);

    return directory === undefined ? [] : woff2Tables(data, directory);
};

const nameTables = (data: Buffer): Buffer[] => {
    const signature = readTag(data, 0);

    if (signature === SIGNATURE_WOFF) {
        return woffNameTables(data);
    }

    if (signature === SIGNATURE_WOFF2) {
        return woff2NameTables(data);
    }

    return signature === TAG_TTCF ? collectionNameTables(data) : sfntNameTables(data);
};

const familyNames = (font: Buffer): string[] => {
    const names = nameTables(font)
        .map((table) => familyName(table))
        .filter((name) => name !== undefined);

    return [...new Set(names)];
};

const fontFamilyNames = (font: Buffer): string[] => {
    try {
        return familyNames(font);
    } catch {
        return [];
    }
};

export { fontFamilyNames };
