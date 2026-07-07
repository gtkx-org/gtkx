import { collectText, nodeAttr, nodeChildren, nodeTag, type OrderedNode, parseRegistryFile } from "./parse.js";

export type GlParam = {
    name: string;
    cType: string;
    group?: string;
    len?: string;
    objectClass?: string;
};

export type GlCommand = {
    name: string;
    returnCType: string;
    returnGroup?: string;
    params: GlParam[];
};

export type GlEnum = {
    name: string;
    value: string;
    groups: string[];
};

export type GlInterfaceBlock = {
    profile?: string;
    commands: string[];
    enums: string[];
};

export type GlFeature = {
    api: string;
    name: string;
    number: number;
    requires: GlInterfaceBlock[];
    removes: GlInterfaceBlock[];
};

export type GlRegistry = {
    commands: Map<string, GlCommand>;
    enums: GlEnum[];
    features: GlFeature[];
};

const NAME_TAG = "name";
const SKIP_IN_C_TYPE: Set<string> = new Set([NAME_TAG, "comment"]);

const normalizeWhitespace = (text: string): string => text.replace(/\s+/g, " ").trim();

const childNamed = (node: OrderedNode, tag: string): OrderedNode | undefined => {
    for (const child of nodeChildren(node)) {
        if (nodeTag(child) === tag) return child;
    }
    return undefined;
};

const elementName = (node: OrderedNode): string => {
    const nameChild = childNamed(node, NAME_TAG);
    if (nameChild === undefined) return "";
    return normalizeWhitespace(collectText(nameChild, new Set()));
};

const parseParam = (node: OrderedNode): GlParam => {
    const param: GlParam = {
        name: elementName(node),
        cType: normalizeWhitespace(collectText(node, SKIP_IN_C_TYPE)),
    };
    const group = nodeAttr(node, "group");
    const len = nodeAttr(node, "len");
    const objectClass = nodeAttr(node, "class");
    return {
        ...param,
        ...(group !== undefined ? { group } : {}),
        ...(len !== undefined ? { len } : {}),
        ...(objectClass !== undefined ? { objectClass } : {}),
    };
};

const parseCommand = (node: OrderedNode): GlCommand | undefined => {
    const proto = childNamed(node, "proto");
    if (proto === undefined) return undefined;
    const params: GlParam[] = [];
    for (const child of nodeChildren(node)) {
        if (nodeTag(child) === "param") params.push(parseParam(child));
    }
    const returnGroup = nodeAttr(proto, "group");
    return {
        name: elementName(proto),
        returnCType: normalizeWhitespace(collectText(proto, SKIP_IN_C_TYPE)),
        ...(returnGroup !== undefined ? { returnGroup } : {}),
        params,
    };
};

const parseEnums = (node: OrderedNode, into: GlEnum[]): void => {
    for (const child of nodeChildren(node)) {
        if (nodeTag(child) !== "enum") continue;
        const name = nodeAttr(child, "name");
        const value = nodeAttr(child, "value");
        if (name === undefined || value === undefined) continue;
        const group = nodeAttr(child, "group");
        into.push({
            name,
            value,
            groups: group === undefined ? [] : group.split(",").map((part) => part.trim()),
        });
    }
};

const parseInterfaceBlock = (node: OrderedNode): GlInterfaceBlock => {
    const commands: string[] = [];
    const enums: string[] = [];
    for (const child of nodeChildren(node)) {
        const name = nodeAttr(child, "name");
        if (name === undefined) continue;
        const tag = nodeTag(child);
        if (tag === "command") commands.push(name);
        else if (tag === "enum") enums.push(name);
    }
    const profile = nodeAttr(node, "profile");
    return {
        ...(profile !== undefined ? { profile } : {}),
        commands,
        enums,
    };
};

const parseFeature = (node: OrderedNode): GlFeature | undefined => {
    const api = nodeAttr(node, "api");
    const name = nodeAttr(node, "name");
    const number = nodeAttr(node, "number");
    if (api === undefined || name === undefined || number === undefined) return undefined;
    const requires: GlInterfaceBlock[] = [];
    const removes: GlInterfaceBlock[] = [];
    for (const child of nodeChildren(node)) {
        const tag = nodeTag(child);
        if (tag === "require") requires.push(parseInterfaceBlock(child));
        else if (tag === "remove") removes.push(parseInterfaceBlock(child));
    }
    return { api, name, number: Number.parseFloat(number), requires, removes };
};

const parseCommandsSection = (section: OrderedNode, into: Map<string, GlCommand>): void => {
    for (const child of nodeChildren(section)) {
        if (nodeTag(child) !== "command") continue;
        const command = parseCommand(child);
        if (command !== undefined && command.name.length > 0) into.set(command.name, command);
    }
};

export const loadGlRegistry = (path: string): GlRegistry => {
    const commands = new Map<string, GlCommand>();
    const enums: GlEnum[] = [];
    const features: GlFeature[] = [];
    for (const section of parseRegistryFile(path)) {
        const tag = nodeTag(section);
        if (tag === "commands") {
            parseCommandsSection(section, commands);
        } else if (tag === "enums") {
            parseEnums(section, enums);
        } else if (tag === "feature") {
            const feature = parseFeature(section);
            if (feature !== undefined) features.push(feature);
        }
    }
    return { commands, enums, features };
};
