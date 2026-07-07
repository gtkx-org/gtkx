import { toCamelIdentifier } from "@gtkx/utils";
import {
    tArray,
    tBoolean,
    tBuffer,
    tFixedArray,
    tInlineStruct,
    tRef,
    tSizedArray,
    tString,
    tUint64,
} from "../analysis/descriptor.js";
import type { GlCommand } from "./model.js";
import type { CommandPlan, GlScalar, ParamPlan } from "./plan.js";

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

export type InArg = {
    out: false;
    name: string;
    tsType: string;
    descriptor: string;
};

export type OutArg = {
    out: true;
    cellName: string;
    seed: string;
    tsType: string;
    descriptor: string;
    paramIndex: number;
};

type PlannedArg = InArg | OutArg;

type BuildArgOptions = {
    command: GlCommand;
    index: number;
    plan: ParamPlan;
    outIndex: number;
};

const inArg = (name: string, tsType: string, descriptor: string): InArg => ({
    out: false,
    name,
    tsType,
    descriptor,
});

const buildInArg = (options: BuildArgOptions, name: string, track: (alias: string) => string): InArg => {
    const { command, index, plan } = options;
    const param = command.params[index];
    if (param === undefined) throw new Error(`Parameter index ${index} out of range on ${command.name}`);
    switch (plan.kind) {
        case "scalar":
            return inArg(name, track(scalarAliasOrGroup(plan.scalar, param.group)), plan.scalar.descriptor);
        case "boolean":
            return inArg(name, "boolean", tBoolean);
        case "sync":
            return inArg(name, track("GLsync"), tInlineStruct());
        case "string-in":
            return inArg(name, "string", tString("borrowed"));
        case "string-array-in":
            return inArg(name, "string[]", tArray(tString("borrowed")));
        case "array-in": {
            track(scalarAliasOrGroup(plan.scalar, param.group));
            return inArg(name, arrayInTsType(plan.scalar, param.group), tArray(plan.scalar.descriptor));
        }
        case "buffer":
            return inArg(name, `ArrayBufferView | ${track("GLintptr")} | null`, tBuffer);
        case "byte-offset":
            return inArg(name, track("GLintptr"), tUint64);
        case "byte-offset-array":
            return inArg(name, `${track("GLintptr")}[]`, tArray(tUint64));
        default:
            throw new Error(`Plan kind ${plan.kind} is not an input parameter`);
    }
};

const buildOutArg = (options: BuildArgOptions, track: (alias: string) => string): OutArg => {
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
                descriptor: tRef(plan.scalar.descriptor),
                paramIndex: index,
            };
        case "ref-array-out": {
            const sizeIndex = paramIndexByName(command, plan.lenParamName);
            const lenIdentifier = toCamelIdentifier(plan.lenParamName);
            return {
                out: true,
                cellName,
                seed: `const ${cellName} = { value: new Array<number>(${lenIdentifier}).fill(0) };`,
                tsType: `${track(plan.scalar.tsAlias)}[]`,
                descriptor: tRef(tSizedArray(plan.scalar.descriptor, sizeIndex)),
                paramIndex: index,
            };
        }
        case "ref-fixed-out":
            return {
                out: true,
                cellName,
                seed: `const ${cellName} = { value: new Array<number>(${plan.length}).fill(0) };`,
                tsType: `${track(plan.scalar.tsAlias)}[]`,
                descriptor: tRef(tFixedArray(plan.scalar.descriptor, plan.length)),
                paramIndex: index,
            };
        case "string-out":
            return {
                out: true,
                cellName,
                seed: `const ${cellName} = { value: "" };`,
                tsType: "string",
                descriptor: tRef(tString("borrowed", toCamelIdentifier(plan.lenParamName))),
                paramIndex: index,
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

export const planArgs = (
    plan: CommandPlan & { ok: true },
    usedTypes: Set<string>,
): { args: PlannedArg[]; ins: InArg[]; outs: OutArg[] } => {
    const track = trackInto(usedTypes);
    const args: PlannedArg[] = [];
    const ins: InArg[] = [];
    const outs: OutArg[] = [];
    plan.params.forEach((paramPlan, index) => {
        const param = plan.command.params[index];
        if (param === undefined) throw new Error(`Parameter index ${index} out of range on ${plan.command.name}`);
        const options: BuildArgOptions = {
            command: plan.command,
            index,
            plan: paramPlan,
            outIndex: outs.length,
        };
        if (isOutPlan(paramPlan)) {
            const arg = buildOutArg(options, track);
            args.push(arg);
            outs.push(arg);
        } else {
            const arg = buildInArg(options, toCamelIdentifier(param.name), track);
            args.push(arg);
            ins.push(arg);
        }
    });
    return { args, ins, outs };
};

export const scalarPrefixArgs = (plan: CommandPlan & { ok: true }, usedTypes: Set<string>): InArg[] | undefined => {
    const track = trackInto(usedTypes);
    const prefix: InArg[] = [];
    for (let index = 0; index < plan.params.length - 2; index++) {
        const paramPlan = plan.params[index];
        const param = plan.command.params[index];
        if (param === undefined) return undefined;
        if (paramPlan === undefined || paramPlan.kind !== "scalar") return undefined;
        prefix.push(
            buildInArg(
                { command: plan.command, index, plan: paramPlan, outIndex: 0 },
                toCamelIdentifier(param.name),
                track,
            ),
        );
    }
    return prefix;
};
