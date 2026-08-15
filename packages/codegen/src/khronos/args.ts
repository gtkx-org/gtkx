import { toCamelIdentifier } from "@gtkx/utils";
import type { GlCommand, GlParam } from "./model.js";
import type { CommandPlan, GlScalar, ParamPlan, ReturnPlan } from "./plan.js";
import {
    type ArrayLayout,
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
import { paramPairAt } from "./param-pair.js";

type InArg = {
    isOut: false;
    name: string;
    tsType: string;
    descriptor: string;
};

type OutArg = {
    isOut: true;
    cellName: string;
    seed: string;
    tsType: string;
    descriptor: string;
    paramIndex: number;
};

type PlannedArg = InArg | OutArg;
type OutArgCell = Pick<OutArg, "isOut" | "cellName" | "paramIndex">;
type OutArgFields = Pick<OutArg, "seed" | "tsType" | "descriptor">;

type OutArgFieldsOptions = {
    command: GlCommand;
    plan: ParamPlan;
    param: GlParam;
    cellName: string;
    track: (alias: string) => string;
};

type BuildArgOptions = {
    command: GlCommand;
    index: number;
    plan: ParamPlan;
    outIndex: number;
};

const OUT_PLAN_KINDS: Set<string> = new Set(["ref-out", "ref-array-out", "ref-fixed-out", "string-out"]);
const NUMERIC_LAYOUT: ArrayLayout = { isBytes: false };

const scalarAliasOrGroup = (scalar: GlScalar, group: string | undefined): string =>
    group !== undefined && scalar.isGroupBearing === true ? group : scalar.tsAlias;

const returnPlanTsType = (plan: ReturnPlan, group: string | undefined): string => {
    switch (plan.kind) {
        case "void": {
            return "void";
        }
        case "scalar": {
            return scalarAliasOrGroup(plan.scalar, group);
        }
        case "boolean": {
            return "boolean";
        }
        case "string": {
            return "string";
        }
        case "sync": {
            return "GLsync";
        }
        case "opaque-pointer": {
            return "GLpointer";
        }
    }
};

const paramIndexByName = (command: GlCommand, name: string): number => {
    const index = command.params.findIndex((param) => param.name === name);

    if (index === -1) {
        throw new Error(`Command ${command.name} has no parameter named ${name}`);
    }

    return index;
};

const arrayInTsType = (scalar: GlScalar, group: string | undefined): string => {
    const element = scalarAliasOrGroup(scalar, group);

    return scalar.viewType === undefined ? `${element}[]` : `${element}[] | ${scalar.viewType}`;
};

const inArg = (name: string, tsType: string, descriptor: string): InArg => ({
    isOut: false,
    name,
    tsType,
    descriptor,
});

const buildInArg = (options: BuildArgOptions, name: string, track: (alias: string) => string): InArg => {
    const { command, index, plan } = options;
    const param = command.params[index];

    if (param === undefined) {
        throw new Error(`Parameter index ${String(index)} out of range on ${command.name}`);
    }

    switch (plan.kind) {
        case "scalar": {
            return inArg(name, track(scalarAliasOrGroup(plan.scalar, param.group)), plan.scalar.descriptor);
        }
        case "boolean": {
            return inArg(name, "boolean", tBoolean);
        }
        case "sync": {
            return inArg(name, track("GLsync"), tInlineStruct());
        }
        case "string-in": {
            return inArg(name, "string", tString("borrowed"));
        }
        case "string-array-in": {
            return inArg(name, "string[]", tArray(tString("borrowed"), undefined, NUMERIC_LAYOUT));
        }
        case "array-in": {
            track(scalarAliasOrGroup(plan.scalar, param.group));
            const descriptor = tArray(plan.scalar.descriptor, undefined, NUMERIC_LAYOUT);

            return inArg(name, arrayInTsType(plan.scalar, param.group), descriptor);
        }
        case "buffer": {
            return inArg(name, `ArrayBufferView | ${track("GLintptr")} | null`, tBuffer);
        }
        case "byte-offset": {
            return inArg(name, track("GLintptr"), tUint64);
        }
        case "byte-offset-array": {
            return inArg(name, `${track("GLintptr")}[]`, tArray(tUint64, undefined, NUMERIC_LAYOUT));
        }
        case "ref-array-out":
        case "ref-fixed-out":
        case "ref-out":
        case "string-out": {
            throw new Error(`Plan kind ${plan.kind} is not an input parameter`);
        }
    }
};

const outArgFields = (options: OutArgFieldsOptions): OutArgFields => {
    const { command, plan, param, cellName, track } = options;

    switch (plan.kind) {
        case "ref-out": {
            return {
                seed: `const ${cellName} = { value: 0 };`,
                tsType: track(scalarAliasOrGroup(plan.scalar, param.group)),
                descriptor: tRef(plan.scalar.descriptor),
            };
        }
        case "ref-array-out": {
            const sizeIndex = paramIndexByName(command, plan.lenParamName);
            const lenIdentifier = toCamelIdentifier(plan.lenParamName);

            return {
                seed: `const ${cellName} = { value: new Array<number>(${lenIdentifier}).fill(0) };`,
                tsType: `${track(scalarAliasOrGroup(plan.scalar, param.group))}[]`,
                descriptor: tRef(tSizedArray(plan.scalar.descriptor, sizeIndex, undefined, NUMERIC_LAYOUT)),
            };
        }
        case "ref-fixed-out": {
            return {
                seed: `const ${cellName} = { value: new Array<number>(${String(plan.length)}).fill(0) };`,
                tsType: `${track(plan.scalar.tsAlias)}[]`,
                descriptor: tRef(tFixedArray(plan.scalar.descriptor, plan.length, undefined, NUMERIC_LAYOUT)),
            };
        }
        case "string-out": {
            return {
                seed: `const ${cellName} = { value: "" };`,
                tsType: "string",
                descriptor: tRef(tString("borrowed", toCamelIdentifier(plan.lenParamName))),
            };
        }
        case "array-in":
        case "boolean":
        case "buffer":
        case "byte-offset":
        case "byte-offset-array":
        case "scalar":
        case "string-array-in":
        case "string-in":
        case "sync": {
            throw new Error(`Plan kind ${plan.kind} is not an output parameter`);
        }
    }
};

const buildOutArg = (options: BuildArgOptions, track: (alias: string) => string): OutArg => {
    const { command, index, plan, outIndex } = options;
    const param = command.params[index];

    if (param === undefined) {
        throw new Error(`Parameter index ${String(index)} out of range on ${command.name}`);
    }

    const cellName = `__out${String(outIndex)}`;
    const cell: OutArgCell = { isOut: true, cellName, paramIndex: index };

    return { ...cell, ...outArgFields({ command, plan, param, cellName, track }) };
};

const isOutPlan = (plan: ParamPlan): boolean => OUT_PLAN_KINDS.has(plan.kind);
const isInArg = (arg: PlannedArg): arg is InArg => !arg.isOut;
const isOutArg = (arg: PlannedArg): arg is OutArg => arg.isOut;

const buildArg = (options: BuildArgOptions, name: string, track: (alias: string) => string): PlannedArg =>
    isOutPlan(options.plan) ? buildOutArg(options, track) : buildInArg(options, name, track);

const trackInto =
    (usedTypes: Set<string>) =>
        (alias: string): string => {
            usedTypes.add(alias);

            return alias;
        };

const planArgs = (
    plan: CommandPlan & { isOk: true },
    usedTypes: Set<string>,
): { args: PlannedArg[]; ins: InArg[]; outs: OutArg[] } => {
    const track = trackInto(usedTypes);
    const args: PlannedArg[] = [];

    for (const [index, paramPlan] of plan.params.entries()) {
        const param = plan.command.params[index];

        if (param === undefined) {
            throw new Error(`Parameter index ${String(index)} out of range on ${plan.command.name}`);
        }

        const options: BuildArgOptions = {
            command: plan.command,
            index,
            plan: paramPlan,
            outIndex: args.filter(isOutArg).length,
        };

        args.push(buildArg(options, toCamelIdentifier(param.name), track));
    }

    return { args, ins: args.filter(isInArg), outs: args.filter(isOutArg) };
};

const scalarPrefixArg = (
    plan: CommandPlan & { isOk: true },
    index: number,
    track: (alias: string) => string,
): InArg | undefined => {
    const { paramPlan, param } = paramPairAt(plan, index);

    if (param === undefined) {
        return undefined;
    }

    if (paramPlan?.kind !== "scalar") {
        return undefined;
    }

    return buildInArg(
        { command: plan.command, index, plan: paramPlan, outIndex: 0 },
        toCamelIdentifier(param.name),
        track,
    );
};

const scalarPrefixArgs = (plan: CommandPlan & { isOk: true }, usedTypes: Set<string>): InArg[] | undefined => {
    const track = trackInto(usedTypes);
    const prefix: InArg[] = [];

    for (let index = 0; index < plan.params.length - 2; index++) {
        const arg = scalarPrefixArg(plan, index, track);

        if (arg === undefined) {
            return undefined;
        }

        prefix.push(arg);
    }

    return prefix;
};

export { returnPlanTsType, scalarAliasOrGroup, trackInto, planArgs, scalarPrefixArgs, type InArg, type OutArg };
