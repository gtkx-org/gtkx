import { quote, toCamelIdentifier, toLowerFirst } from "@gtkx/utils";
import { tBind, tInlineStruct, tRef, tString, tUint8, tVoid } from "../writers/descriptor.js";
import type { CommandPlan, ReturnPlan } from "./ctype.js";
import { commandJsDoc, inParamDocLine, REFPAGES_BASE } from "./jsdoc.js";
import { buildSlots, type EmittedOut, scalarAliasOrGroup, scalarPrefixSlots, trackInto } from "./slots.js";

const GL_LIB_EXPRESSION = "LIB";

const commandExportName = (name: string): string => {
    const stripped = name.startsWith("gl") ? toLowerFirst(name.slice(2)) : name;
    return /^[0-9]/.test(stripped) ? name : toCamelIdentifier(stripped);
};

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
            return { tsType: alias, descriptor: plan.scalar.tExpr, expr: (call) => `${call} as ${alias}` };
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

const returnTsType = (returned: EmittedReturn, outs: EmittedOut[]): string => {
    if (outs.length === 0) return returned.tsType;
    const outTypes = outs.map((out) => out.tsType);
    if (returned.expr === undefined) {
        return outTypes.length === 1 && outTypes[0] !== undefined ? outTypes[0] : `[${outTypes.join(", ")}]`;
    }
    return `[${returned.tsType}, ${outTypes.join(", ")}]`;
};

const returnStatements = (call: string, returned: EmittedReturn, outs: EmittedOut[]): string[] => {
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
    const { slots, ins, outs } = buildSlots(plan, usedTypes);
    const returned = buildEmittedReturn(plan.returnPlan, command.returnGroup, usedTypes);
    const signature = ins.map((slot) => `${slot.name}: ${slot.tsType}`).join(", ");
    const argNames = slots.map((slot) => (slot.out ? slot.cellName : slot.name)).join(", ");
    const descriptors = renderDescriptorList(slots.map((slot) => slot.descriptor));
    const tsReturn = returnTsType(returned, outs);
    const jsDoc = commandJsDoc({ command, feature, ins, outs, returnPlan: plan.returnPlan });
    const seeds = outs.map((out) => out.seed);
    const hasStringOut = plan.params.some((paramPlan) => paramPlan.kind === "string-out");
    if (hasStringOut) {
        const bindExpression = tBind({
            libExpr: GL_LIB_EXPRESSION,
            symbolExpr: quote(command.name),
            argList: descriptors,
            returnType: returned.descriptor,
        });
        const body = [
            ...seeds,
            `const binding = ${bindExpression};`,
            ...returnStatements(`binding(${argNames})`, returned, outs),
        ]
            .map((line) => `    ${line}`)
            .join("\n");
        return {
            exportName,
            declaration: `${jsDoc}\nexport function ${exportName}(${signature}): ${tsReturn} {\n${body}\n}`,
        };
    }
    const bindingName = toCamelIdentifier(command.name);
    const bindExpression = tBind({
        libExpr: GL_LIB_EXPRESSION,
        symbolExpr: quote(command.name),
        argList: descriptors,
        returnType: returned.descriptor,
    });
    const binding = `const ${bindingName} = ${bindExpression};`;
    const body = [...seeds, ...returnStatements(`${bindingName}(${argNames})`, returned, outs)]
        .map((line) => `    ${line}`)
        .join("\n");
    return {
        exportName,
        binding,
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
    if (outPlan.lenParamName !== countParam.name || outParam.kind === undefined) return undefined;
    const prefix = scalarPrefixSlots(plan, usedTypes);
    if (prefix === undefined) return undefined;
    const exportName = singularize(commandExportName(plan.command.name));
    const bindingName = `${plan.command.name}Single`;
    const descriptors = [
        ...prefix.map((slot) => slot.descriptor),
        `${countPlan.scalar.tExpr}`,
        tRef(outPlan.scalar.tExpr),
    ];
    usedTypes.add(outPlan.scalar.tsAlias);
    const signature = prefix.map((slot) => `${slot.name}: ${slot.tsType}`).join(", ");
    const callArgs = [...prefix.map((slot) => slot.name), "1", "out"].join(", ");
    const jsDoc = [
        "/**",
        ` * Returns one ${outParam.kind} object name via \`${plan.command.name}(${prefix.length > 0 ? "..., " : ""}1, ...)\`.`,
        " *",
        ` * Provided by \`${feature}\`.`,
        ...prefix.map((slot) => inParamDocLine(plan.command, slot)),
        ` * @returns The new ${outParam.kind} object name`,
        ` * @see ${REFPAGES_BASE}/${plan.command.name}.xhtml`,
        " */",
    ].join("\n");
    const body = [`    const out = { value: 0 };`, `    ${bindingName}(${callArgs});`, "    return out.value;"].join(
        "\n",
    );
    const binding = tBind({
        libExpr: GL_LIB_EXPRESSION,
        symbolExpr: quote(plan.command.name),
        argList: renderDescriptorList(descriptors),
        returnType: tVoid,
    });
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
    if (arrayParam.len !== countParam.name || arrayParam.kind === undefined) return undefined;
    const exportName = singularize(commandExportName(plan.command.name));
    usedTypes.add(arrayPlan.scalar.tsAlias);
    const jsDoc = [
        "/**",
        ` * Deletes one ${arrayParam.kind} object name via \`${plan.command.name}(1, ...)\`.`,
        " *",
        ` * Provided by \`${feature}\`.`,
        ` * @param name - The ${arrayParam.kind} object name to delete`,
        ` * @see ${REFPAGES_BASE}/${plan.command.name}.xhtml`,
        " */",
    ].join("\n");
    return {
        exportName,
        declaration: `${jsDoc}\nexport function ${exportName}(name: ${arrayPlan.scalar.tsAlias}): void {\n    ${plan.command.name}(1, [name]);\n}`,
    };
};
