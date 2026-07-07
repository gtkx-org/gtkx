import { lowerFirst, sourceStringLiteral, toCamelIdentifier } from "@gtkx/utils";
import { tBind, tInlineStruct, tRef, tString, tUint8, tVoid } from "../analysis/descriptor.js";
import { type OutArg, planArgs, scalarAliasOrGroup, scalarPrefixArgs, trackInto } from "./args.js";
import { commandJsDoc, inParamDocLine, singularJsDoc } from "./jsdoc.js";
import type { CommandPlan, ReturnPlan } from "./plan.js";

const GL_LIB_EXPRESSION = "LIB";

const glBind = (name: string, argList: string, returnType: string): string =>
    tBind({
        libExpr: GL_LIB_EXPRESSION,
        symbolExpr: sourceStringLiteral(name),
        argList,
        returnType,
    });

const commandExportName = (name: string): string =>
    toCamelIdentifier(name.startsWith("gl") ? lowerFirst(name.slice(2)) : name);

const singularize = (plural: string): string =>
    plural.endsWith("ies") ? `${plural.slice(0, -3)}y` : plural.replace(/s$/, "");

const renderDescriptorList = (descriptors: string[]): string =>
    descriptors.length === 0 ? "[]" : `[${descriptors.join(", ")}]`;

export type RenderedCommand = {
    exportName: string;
    binding?: string;
    declaration: string;
};

type EmittedReturn = {
    tsType: string;
    descriptor: string;
    expr?: (call: string) => string;
};

const buildEmittedReturn = (
    plan: ReturnPlan,
    returnGroup: string | undefined,
    usedTypes: Set<string>,
): EmittedReturn => {
    const track = trackInto(usedTypes);
    switch (plan.kind) {
        case "void":
            return { tsType: "void", descriptor: tVoid };
        case "scalar": {
            const alias = track(scalarAliasOrGroup(plan.scalar, returnGroup));
            return { tsType: alias, descriptor: plan.scalar.descriptor, expr: (call) => `${call} as ${alias}` };
        }
        case "boolean":
            return { tsType: "boolean", descriptor: tUint8, expr: (call) => `(${call} as number) !== 0` };
        case "string":
            return { tsType: "string", descriptor: tString("borrowed"), expr: (call) => `${call} as string` };
        case "sync":
            return { tsType: track("GLsync"), descriptor: tInlineStruct(), expr: (call) => `${call} as GLsync` };
        case "opaque-pointer":
            return {
                tsType: track("GLpointer"),
                descriptor: tInlineStruct(),
                expr: (call) => `${call} as GLpointer`,
            };
    }
};

const returnTsType = (returned: EmittedReturn, outs: OutArg[]): string => {
    if (outs.length === 0) return returned.tsType;
    const outTypes = outs.map((out) => out.tsType);
    if (returned.expr === undefined) {
        return outTypes.length === 1 && outTypes[0] !== undefined ? outTypes[0] : `[${outTypes.join(", ")}]`;
    }
    return `[${returned.tsType}, ${outTypes.join(", ")}]`;
};

const returnStatements = (call: string, returned: EmittedReturn, outs: OutArg[]): string[] => {
    if (outs.length === 0) {
        return returned.expr === undefined ? [`${call};`] : [`return ${returned.expr(call)};`];
    }
    const outValues = outs.map((out) => `${out.cellName}.value`);
    if (returned.expr === undefined) {
        const tail = outValues.length === 1 ? `return ${outValues[0]};` : `return [${outValues.join(", ")}];`;
        return [`${call};`, tail];
    }
    return [`const result = ${call};`, `return [${returned.expr("result")}, ${outValues.join(", ")}];`];
};

export const renderCommand = (
    plan: CommandPlan & { ok: true },
    feature: string,
    usedTypes: Set<string>,
): RenderedCommand => {
    const { command } = plan;
    const exportName = commandExportName(command.name);
    const { args, ins, outs } = planArgs(plan, usedTypes);
    const returned = buildEmittedReturn(plan.returnPlan, command.returnGroup, usedTypes);
    const signature = ins.map((arg) => `${arg.name}: ${arg.tsType}`).join(", ");
    const argNames = args.map((arg) => (arg.out ? arg.cellName : arg.name)).join(", ");
    const descriptors = renderDescriptorList(args.map((arg) => arg.descriptor));
    const tsReturn = returnTsType(returned, outs);
    const jsDoc = commandJsDoc({ command, feature, ins, outs, returnPlan: plan.returnPlan });
    const seeds = outs.map((out) => out.seed);
    const bindExpression = glBind(command.name, descriptors, returned.descriptor);
    const inline = plan.params.some((paramPlan) => paramPlan.kind === "string-out");
    const bindingName = inline ? "binding" : toCamelIdentifier(command.name);
    const body = [
        ...seeds,
        ...(inline ? [`const ${bindingName} = ${bindExpression};`] : []),
        ...returnStatements(`${bindingName}(${argNames})`, returned, outs),
    ]
        .map((line) => `    ${line}`)
        .join("\n");
    return {
        exportName,
        ...(inline ? {} : { binding: `const ${bindingName} = ${bindExpression};` }),
        declaration: `${jsDoc}\nexport function ${exportName}(${signature}): ${tsReturn} {\n${body}\n}`,
    };
};

const GEN_FAMILY = /^gl(Gen|Create)[A-Z][A-Za-z]*s$/;
const DELETE_FAMILY = /^glDelete[A-Z][A-Za-z]*s$/;

export const deriveGenSingular = (
    plan: CommandPlan & { ok: true },
    feature: string,
    usedTypes: Set<string>,
): RenderedCommand | undefined => {
    if (!GEN_FAMILY.test(plan.command.name)) return undefined;
    const countIndex = plan.params.length - 2;
    const outIndex = plan.params.length - 1;
    const countPlan = plan.params[countIndex];
    const outPlan = plan.params[outIndex];
    const countParam = plan.command.params[countIndex];
    const outParam = plan.command.params[outIndex];
    if (countPlan?.kind !== "scalar" || outPlan?.kind !== "ref-array-out") return undefined;
    if (countParam === undefined || outParam === undefined) return undefined;
    if (outPlan.lenParamName !== countParam.name || outParam.objectClass === undefined) return undefined;
    const prefix = scalarPrefixArgs(plan, usedTypes);
    if (prefix === undefined) return undefined;
    const exportName = singularize(commandExportName(plan.command.name));
    const bindingName = `${plan.command.name}Single`;
    const descriptors = [
        ...prefix.map((arg) => arg.descriptor),
        countPlan.scalar.descriptor,
        tRef(outPlan.scalar.descriptor),
    ];
    usedTypes.add(outPlan.scalar.tsAlias);
    const signature = prefix.map((arg) => `${arg.name}: ${arg.tsType}`).join(", ");
    const callArgs = [...prefix.map((arg) => arg.name), "1", "out"].join(", ");
    const jsDoc = singularJsDoc({
        commandName: plan.command.name,
        feature,
        summary: `Returns one ${outParam.objectClass} object name via \`${plan.command.name}(${prefix.length > 0 ? "..., " : ""}1, ...)\`.`,
        body: [
            ...prefix.map((arg) => inParamDocLine(plan.command, arg)),
            ` * @returns The new ${outParam.objectClass} object name`,
        ],
    });
    const body = [`    const out = { value: 0 };`, `    ${bindingName}(${callArgs});`, "    return out.value;"].join(
        "\n",
    );
    const binding = glBind(plan.command.name, renderDescriptorList(descriptors), tVoid);
    return {
        exportName,
        binding: `const ${bindingName} = ${binding};`,
        declaration: `${jsDoc}\nexport function ${exportName}(${signature}): ${outPlan.scalar.tsAlias} {\n${body}\n}`,
    };
};

export const deriveDeleteSingular = (
    plan: CommandPlan & { ok: true },
    feature: string,
    usedTypes: Set<string>,
): RenderedCommand | undefined => {
    if (!DELETE_FAMILY.test(plan.command.name)) return undefined;
    if (plan.params.length !== 2) return undefined;
    const [countPlan, arrayPlan] = plan.params;
    const [countParam, arrayParam] = plan.command.params;
    if (countPlan?.kind !== "scalar" || arrayPlan?.kind !== "array-in") return undefined;
    if (countParam === undefined || arrayParam === undefined) return undefined;
    if (arrayParam.len !== countParam.name || arrayParam.objectClass === undefined) return undefined;
    const exportName = singularize(commandExportName(plan.command.name));
    usedTypes.add(arrayPlan.scalar.tsAlias);
    const jsDoc = singularJsDoc({
        commandName: plan.command.name,
        feature,
        summary: `Deletes one ${arrayParam.objectClass} object name via \`${plan.command.name}(1, ...)\`.`,
        body: [` * @param name - The ${arrayParam.objectClass} object name to delete`],
    });
    return {
        exportName,
        declaration: `${jsDoc}\nexport function ${exportName}(name: ${arrayPlan.scalar.tsAlias}): void {\n    ${plan.command.name}(1, [name]);\n}`,
    };
};
