import { toCamelIdentifier } from "@gtkx/utils";
import {
    tArray,
    tBlob,
    tBoolean,
    tFixedArray,
    tInlineStruct,
    tRef,
    tSizedArray,
    tString,
    tUint64,
} from "../writers/descriptor.js";
import type { CommandPlan, GlScalar, ParamPlan } from "./ctype.js";
import type { GlCommand } from "./model.js";

export const scalarAliasOrGroup = (scalar: GlScalar, group: string | undefined): string =>
    group !== undefined && scalar.groupBearing === true ? group : scalar.tsAlias;

const paramIndexByName = (command: GlCommand, name: string): number => {
    const index = command.params.findIndex((param) => param.name === name);
    if (index < 0) throw new Error(`Command ${command.name} has no parameter named ${name}`);
    return index;
};

const arrayInTsType = (scalar: GlScalar, group: string | undefined): string => {
    const element = scalarAliasOrGroup(scalar, group);
    return scalar.viewType === undefined ? `${element}[]` : `${element}[] | ${scalar.viewType}`;
};

export type EmittedIn = {
    out: false;
    name: string;
    tsType: string;
    descriptor: string;
};

export type EmittedOut = {
    out: true;
    cellName: string;
    seed: string;
    tsType: string;
    descriptor: string;
    docName: string;
    docCType: string;
};

export type EmittedSlot = EmittedIn | EmittedOut;

type BuildSlotOptions = {
    command: GlCommand;
    index: number;
    plan: ParamPlan;
    outIndex: number;
    usedTypes: Set<string>;
};

const inSlot = (name: string, tsType: string, descriptor: string): EmittedIn => ({
    out: false,
    name,
    tsType,
    descriptor,
});

const buildInSlot = (options: BuildSlotOptions, name: string, track: (alias: string) => string): EmittedIn => {
    const { command, index, plan } = options;
    const param = command.params[index];
    if (param === undefined) throw new Error(`Parameter index ${index} out of range on ${command.name}`);
    switch (plan.kind) {
        case "scalar":
            return inSlot(name, track(scalarAliasOrGroup(plan.scalar, param.group)), `${plan.scalar.tExpr}`);
        case "boolean":
            return inSlot(name, "boolean", tBoolean);
        case "sync":
            return inSlot(name, track("GLsync"), tInlineStruct());
        case "string-in":
            return inSlot(name, "string", tString("borrowed"));
        case "string-array-in":
            return inSlot(name, "string[]", tArray(tString("borrowed")));
        case "array-in": {
            track(scalarAliasOrGroup(plan.scalar, param.group));
            return inSlot(name, arrayInTsType(plan.scalar, param.group), tArray(plan.scalar.tExpr));
        }
        case "blob":
            return inSlot(name, `ArrayBufferView | ${track("GLintptr")} | null`, tBlob);
        case "byte-offset":
            return inSlot(name, track("GLintptr"), tUint64);
        case "byte-offset-array":
            return inSlot(name, `${track("GLintptr")}[]`, tArray(tUint64));
        default:
            throw new Error(`Plan kind ${plan.kind} is not an input parameter`);
    }
};

const buildOutSlot = (options: BuildSlotOptions, track: (alias: string) => string): EmittedOut => {
    const { command, index, plan, outIndex } = options;
    const param = command.params[index];
    if (param === undefined) throw new Error(`Parameter index ${index} out of range on ${command.name}`);
    const cellName = `out${outIndex}`;
    switch (plan.kind) {
        case "ref-out":
            return {
                out: true,
                cellName,
                seed: `const ${cellName} = { value: 0 };`,
                tsType: track(scalarAliasOrGroup(plan.scalar, param.group)),
                descriptor: tRef(plan.scalar.tExpr),
                docName: param.name,
                docCType: param.cType,
            };
        case "ref-array-out": {
            const sizeIndex = paramIndexByName(command, plan.lenParamName);
            const lenIdentifier = toCamelIdentifier(plan.lenParamName);
            return {
                out: true,
                cellName,
                seed: `const ${cellName} = { value: new Array<number>(${lenIdentifier}).fill(0) };`,
                tsType: `${track(plan.scalar.tsAlias)}[]`,
                descriptor: tRef(tSizedArray(plan.scalar.tExpr, sizeIndex)),
                docName: param.name,
                docCType: param.cType,
            };
        }
        case "ref-fixed-out":
            return {
                out: true,
                cellName,
                seed: `const ${cellName} = { value: new Array<number>(${plan.length}).fill(0) };`,
                tsType: `${track(plan.scalar.tsAlias)}[]`,
                descriptor: tRef(tFixedArray(plan.scalar.tExpr, plan.length)),
                docName: param.name,
                docCType: param.cType,
            };
        case "string-out":
            return {
                out: true,
                cellName,
                seed: `const ${cellName} = { value: "" };`,
                tsType: "string",
                descriptor: tRef(tString("borrowed", toCamelIdentifier(plan.lenParamName))),
                docName: param.name,
                docCType: param.cType,
            };
        default:
            throw new Error(`Plan kind ${plan.kind} is not an output parameter`);
    }
};

const isOutPlan = (plan: ParamPlan): boolean =>
    plan.kind === "ref-out" ||
    plan.kind === "ref-array-out" ||
    plan.kind === "ref-fixed-out" ||
    plan.kind === "string-out";

export const trackInto =
    (usedTypes: Set<string>) =>
    (alias: string): string => {
        usedTypes.add(alias);
        return alias;
    };

export const buildSlots = (
    plan: CommandPlan & { ok: true },
    usedTypes: Set<string>,
): { slots: EmittedSlot[]; ins: EmittedIn[]; outs: EmittedOut[] } => {
    const track = trackInto(usedTypes);
    const slots: EmittedSlot[] = [];
    const ins: EmittedIn[] = [];
    const outs: EmittedOut[] = [];
    plan.params.forEach((paramPlan, index) => {
        const param = plan.command.params[index];
        if (param === undefined) throw new Error(`Parameter index ${index} out of range on ${plan.command.name}`);
        const options: BuildSlotOptions = {
            command: plan.command,
            index,
            plan: paramPlan,
            outIndex: outs.length,
            usedTypes,
        };
        if (isOutPlan(paramPlan)) {
            const slot = buildOutSlot(options, track);
            slots.push(slot);
            outs.push(slot);
        } else {
            const slot = buildInSlot(options, toCamelIdentifier(param.name), track);
            slots.push(slot);
            ins.push(slot);
        }
    });
    return { slots, ins, outs };
};

export const scalarPrefixSlots = (
    plan: CommandPlan & { ok: true },
    usedTypes: Set<string>,
): EmittedIn[] | undefined => {
    const track = trackInto(usedTypes);
    const prefix: EmittedIn[] = [];
    for (let index = 0; index < plan.params.length - 2; index++) {
        const paramPlan = plan.params[index];
        const param = plan.command.params[index];
        if (param === undefined) return undefined;
        if (paramPlan === undefined || (paramPlan.kind !== "scalar" && paramPlan.kind !== "boolean")) return undefined;
        prefix.push(
            buildInSlot(
                { command: plan.command, index, plan: paramPlan, outIndex: 0, usedTypes },
                toCamelIdentifier(param.name),
                track,
            ),
        );
    }
    return prefix;
};
