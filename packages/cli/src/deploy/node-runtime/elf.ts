import { readFileSync } from "node:fs";

type ElfSection = {
    name: string;
    offset: number;
    size: number;
};

type ElfInfo = {
    needed: string[];
    glibcMinimum: string | null;
};

type DynamicEntry = {
    tag: number;
    value: number;
};

const ELF_MAGIC = "ELF";
const CLASS_64 = 2;
const LITTLE_ENDIAN = 1;
const OFFSET_CLASS = 4;
const OFFSET_DATA = 5;
const OFFSET_SECTION_HEADERS = 0x28;
const OFFSET_SECTION_ENTRY_SIZE = 0x3A;
const OFFSET_SECTION_COUNT = 0x3C;
const OFFSET_SECTION_NAME_INDEX = 0x3E;
const SECTION_NAME = 0;
const SECTION_OFFSET = 24;
const SECTION_SIZE = 32;
const DYNAMIC_ENTRY_SIZE = 16;
const DT_NULL = 0;
const DT_NEEDED = 1;
const DYNAMIC_VALUE_OFFSET = 8;
const GLIBC_VERSION = /GLIBC_(\d+)\.(\d+)/g;
const VERSION_RADIX = 1000;

const assertElf64 = (buffer: Buffer, path: string): void => {
    if (buffer.length < OFFSET_SECTION_NAME_INDEX || buffer.subarray(0, 4).toString("latin1") !== ELF_MAGIC) {
        throw new Error(`Cannot read ${path}: it is not an ELF binary`);
    }

    if (buffer.readUInt8(OFFSET_CLASS) !== CLASS_64 || buffer.readUInt8(OFFSET_DATA) !== LITTLE_ENDIAN) {
        throw new Error(`Cannot read ${path}: only little-endian 64-bit ELF binaries are supported`);
    }
};

const readCString = (buffer: Buffer, start: number): string => {
    const end = buffer.indexOf(0, start);

    return buffer.subarray(start, end === -1 ? buffer.length : end).toString("latin1");
};

const readSection = (buffer: Buffer, base: number, names: Buffer): ElfSection => ({
    name: readCString(names, buffer.readUInt32LE(base + SECTION_NAME)),
    offset: Number(buffer.readBigUInt64LE(base + SECTION_OFFSET)),
    size: Number(buffer.readBigUInt64LE(base + SECTION_SIZE)),
});

const readSections = (buffer: Buffer): ElfSection[] => {
    const headers = Number(buffer.readBigUInt64LE(OFFSET_SECTION_HEADERS));
    const entrySize = buffer.readUInt16LE(OFFSET_SECTION_ENTRY_SIZE);
    const count = buffer.readUInt16LE(OFFSET_SECTION_COUNT);
    const nameIndex = buffer.readUInt16LE(OFFSET_SECTION_NAME_INDEX);
    const nameBase = headers + nameIndex * entrySize;
    const nameOffset = Number(buffer.readBigUInt64LE(nameBase + SECTION_OFFSET));
    const nameSize = Number(buffer.readBigUInt64LE(nameBase + SECTION_SIZE));
    const names = buffer.subarray(nameOffset, nameOffset + nameSize);

    return Array.from({ length: count }, (_, index) => readSection(buffer, headers + index * entrySize, names));
};

const sectionFor = (sections: ElfSection[], name: string): ElfSection | undefined =>
    sections.find((section) => section.name === name);

const readDynamicEntries = (buffer: Buffer, dynamic: ElfSection): DynamicEntry[] => {
    const entries: DynamicEntry[] = [];

    for (let cursor = 0; cursor + DYNAMIC_ENTRY_SIZE <= dynamic.size; cursor += DYNAMIC_ENTRY_SIZE) {
        const base = dynamic.offset + cursor;
        const tag = Number(buffer.readBigUInt64LE(base));

        if (tag === DT_NULL) {
            break;
        }

        entries.push({ tag, value: Number(buffer.readBigUInt64LE(base + DYNAMIC_VALUE_OFFSET)) });
    }

    return entries;
};

const readNeeded = (buffer: Buffer, dynamic: ElfSection | undefined, strings: Buffer): string[] => {
    if (dynamic === undefined) {
        return [];
    }

    return readDynamicEntries(buffer, dynamic)
        .filter((entry) => entry.tag === DT_NEEDED)
        .map((entry) => readCString(strings, entry.value));
};

const getRank = (version: number[]): number => (version[0] ?? 0) * VERSION_RADIX + (version[1] ?? 0);

const highestVersion = (versions: number[][]): number[] | null => {
    let highest: number[] | null = null;

    for (const version of versions) {
        if (highest === null || getRank(version) > getRank(highest)) {
            highest = version;
        }
    }

    return highest;
};

const formatVersion = (version: number[] | null): string | null =>
    version === null ? null : `${String(version[0] ?? 0)}.${String(version[1] ?? 0)}`;

const readGlibcMinimum = (strings: Buffer): string | null => {
    const found = strings
        .toString("latin1")
        .matchAll(GLIBC_VERSION)
        .map((match) => [Number(match[1]), Number(match[2])])
        .toArray();

    return formatVersion(highestVersion(found));
};

const stringTable = (buffer: Buffer, dynstr: ElfSection | undefined): Buffer =>
    dynstr === undefined ? Buffer.alloc(0) : buffer.subarray(dynstr.offset, dynstr.offset + dynstr.size);

const readElfInfo = (path: string): ElfInfo => {
    const buffer = readFileSync(path);
    assertElf64(buffer, path);
    const sections = readSections(buffer);
    const strings = stringTable(buffer, sectionFor(sections, ".dynstr"));

    return {
        needed: readNeeded(buffer, sectionFor(sections, ".dynamic"), strings),
        glibcMinimum: readGlibcMinimum(strings),
    };
};

export { type ElfInfo, readElfInfo };
