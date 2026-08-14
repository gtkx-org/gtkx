import { sourceStringLiteral, toCamelIdentifier } from "@gtkx/utils";
import type { GlDocContext } from "./doc-context.js";
import type { CommandPlan, GlScalar, ReturnPlan } from "./plan.js";
import type { GlSymbolProvenance } from "./select.js";
import { tBind, tInlineStruct, tRef, tString, tUint8, tVoid } from "../analysis/descriptor.js";
import { type InArg, type OutArg, planArgs, returnPlanTsType, scalarPrefixArgs, trackInto } from "./args.js";
import { commandJsDoc, derivedJsDoc, inParamDocLine } from "./jsdoc.js";
import { commandExportName } from "./notes.js";

type RenderedCommand = {
    exportName: string;
    binding?: string;
    declaration: string;
};

type SingularContext = {
    plan: CommandPlan & { isOk: true };
    provenance: GlSymbolProvenance;
    docs: GlDocContext;
};

type EmittedReturn = {
    tsType: string;
    descriptor: string;
    expr?: (call: string) => string;
};

type GenSingularShape = {
    countScalar: GlScalar;
    outScalar: GlScalar;
    objectClass: string;
};

const GL_LIB_EXPRESSION = "LIB";
const GEN_FAMILY = /^gl(Gen|Create)[A-Z][A-Za-z]*s$/;
const DELETE_FAMILY = /^glDelete[A-Z][A-Za-z]*s$/;

const glBind = (name: string, argList: string, returnType: string): string =>
    tBind({
        libExpr: GL_LIB_EXPRESSION,
        symbolExpr: sourceStringLiteral(name),
        argList,
        returnType,
    });

const singularize = (plural: string): string =>
    plural.endsWith("ies") ? `${plural.slice(0, -3)}y` : plural.replace(/s$/, "");

const renderDescriptorList = (descriptors: string[]): string =>
    descriptors.length === 0 ? "[]" : `[${descriptors.join(", ")}]`;

const buildEmittedReturn = (
    plan: ReturnPlan,
    returnGroup: string | undefined,
    usedTypes: Set<string>,
): EmittedReturn => {
    const tsType = trackInto(usedTypes)(returnPlanTsType(plan, returnGroup));
    const cast = (call: string): string => `${call} as ${tsType}`;

    switch (plan.kind) {
        case "void": {
            return { tsType, descriptor: tVoid };
        }
        case "scalar": {
            return { tsType, descriptor: plan.scalar.descriptor, expr: cast };
        }
        case "boolean": {
            return { tsType, descriptor: tUint8, expr: (call) => `(${call} as number) !== 0` };
        }
        case "string": {
            return { tsType, descriptor: tString("borrowed"), expr: cast };
        }
        case "sync": {
            return { tsType, descriptor: tInlineStruct(), expr: cast };
        }
        case "opaque-pointer": {
            return { tsType, descriptor: tInlineStruct(), expr: cast };
        }
    }
};

const returnTsType = (returned: EmittedReturn, outs: OutArg[]): string => {
    if (outs.length === 0) {
        return returned.tsType;
    }

    const outTypes = outs.map((out) => out.tsType);

    if (returned.expr === undefined) {
        return outTypes.length === 1 && outTypes[0] !== undefined ? outTypes[0] : `[${outTypes.join(", ")}]`;
    }

    return `[${returned.tsType}, ${outTypes.join(", ")}]`;
};

const returnNoOut = (call: string, returned: EmittedReturn): string[] =>
    returned.expr === undefined ? [`${call};`] : [`return ${returned.expr(call)};`];

const returnStatements = (call: string, returned: EmittedReturn, outs: OutArg[]): string[] => {
    if (outs.length === 0) {
        return returnNoOut(call, returned);
    }

    const outValues = outs.map((out) => `${out.cellName}.value`);

    if (returned.expr === undefined) {
        const [single] = outValues;

        const tail =
            single !== undefined && outValues.length === 1
                ? `return ${single};`
                : `return [${outValues.join(", ")}];`;

        return [`${call};`, tail];
    }

    return [`const __result = ${call};`, `return [${returned.expr("__result")}, ${outValues.join(", ")}];`];
};

const renderCommand = (
    plan: CommandPlan & { isOk: true },
    provenance: GlSymbolProvenance,
    usedTypes: Set<string>,
    docs: GlDocContext,
): RenderedCommand => {
    const { command } = plan;
    const exportName = commandExportName(command.name);
    const { args, ins, outs } = planArgs(plan, usedTypes);
    const returned = buildEmittedReturn(plan.returnPlan, command.returnGroup, usedTypes);
    const signature = ins.map((arg) => `${arg.name}: ${arg.tsType}`).join(", ");
    const argNames = args.map((arg) => (arg.isOut ? arg.cellName : arg.name)).join(", ");
    const descriptors = renderDescriptorList(args.map((arg) => arg.descriptor));
    const tsReturn = returnTsType(returned, outs);
    const jsDoc = commandJsDoc({ plan, provenance, ins, outs, docs });
    const seeds = outs.map((out) => out.seed);
    const bindExpression = glBind(command.name, descriptors, returned.descriptor);
    const isInline = plan.params.some((paramPlan) => paramPlan.kind === "string-out");
    const bindingName = isInline ? "__binding" : toCamelIdentifier(command.name);

    const body = [
        ...seeds,
        ...(isInline ? [`const ${bindingName} = ${bindExpression};`] : []),
        ...returnStatements(`${bindingName}(${argNames})`, returned, outs),
    ]
        .map((line) => `    ${line}`)
        .join("\n");

    return {
        exportName,
        ...(!isInline && { binding: `const ${bindingName} = ${bindExpression};` }),
        declaration: `${jsDoc}\nexport function ${exportName}(${signature}): ${tsReturn} {\n${body}\n}`,
    };
};

const singularCommandJsDoc = (context: SingularContext, summary: string, body: string[]): string =>
    derivedJsDoc({
        command: context.plan.command,
        provenance: context.provenance,
        docs: context.docs,
        summary,
        body,
    });

const genSingularScalars = (
    plan: CommandPlan & { isOk: true },
): { countScalar: GlScalar; outScalar: GlScalar; lenParamName: string } | undefined => {
    const countPlan = plan.params.at(-2);

    if (countPlan?.kind !== "scalar") {
        return undefined;
    }

    const outPlan = plan.params.at(-1);

    if (outPlan?.kind !== "ref-array-out") {
        return undefined;
    }

    return { countScalar: countPlan.scalar, outScalar: outPlan.scalar, lenParamName: outPlan.lenParamName };
};

const genSingularObjectClass = (plan: CommandPlan & { isOk: true }, lenParamName: string): string | undefined => {
    const countParam = plan.command.params[plan.params.length - 2];
    const outParam = plan.command.params[plan.params.length - 1];

    if (countParam === undefined || outParam === undefined) {
        return undefined;
    }

    if (lenParamName !== countParam.name) {
        return undefined;
    }

    return outParam.objectClass;
};

const genSingularShape = (plan: CommandPlan & { isOk: true }): GenSingularShape | undefined => {
    const scalars = genSingularScalars(plan);

    if (scalars === undefined) {
        return undefined;
    }

    const objectClass = genSingularObjectClass(plan, scalars.lenParamName);

    if (objectClass === undefined) {
        return undefined;
    }

    return { countScalar: scalars.countScalar, outScalar: scalars.outScalar, objectClass };
};

const genSingularJsDoc = (context: SingularContext, prefix: InArg[], shape: GenSingularShape): string => {
    const { command } = context.plan;

    return singularCommandJsDoc(
        context,
        `Returns one ${shape.objectClass} object name via ` +
        `\`${command.name}(${prefix.length > 0 ? "..., " : ""}1, ...)\`.`,
        [
            ...prefix.map((arg) => inParamDocLine(context.plan, arg, context.docs)),
            ` * @returns \`${shape.outScalar.tsAlias}\`, object class \`${shape.objectClass}\``,
        ],
    );
};

const deriveGenSingular = (
    plan: CommandPlan & { isOk: true },
    provenance: GlSymbolProvenance,
    usedTypes: Set<string>,
    docs: GlDocContext,
): RenderedCommand | undefined => {
    if (!GEN_FAMILY.test(plan.command.name)) {
        return undefined;
    }

    const shape = genSingularShape(plan);

    if (shape === undefined) {
        return undefined;
    }

    const prefix = scalarPrefixArgs(plan, usedTypes);

    if (prefix === undefined) {
        return undefined;
    }

    const { countScalar, outScalar } = shape;
    const exportName = singularize(commandExportName(plan.command.name));
    const bindingName = `${plan.command.name}Single`;
    const descriptors = [...prefix.map((arg) => arg.descriptor), countScalar.descriptor, tRef(outScalar.descriptor)];
    usedTypes.add(outScalar.tsAlias);
    const signature = prefix.map((arg) => `${arg.name}: ${arg.tsType}`).join(", ");
    const callArgs = [...prefix.map((arg) => arg.name), "1", "__out"].join(", ");
    const jsDoc = genSingularJsDoc({ plan, provenance, docs }, prefix, shape);

    const body = [
        "    const __out = { value: 0 };",
        `    ${bindingName}(${callArgs});`,
        "    return __out.value;",
    ].join("\n");

    const binding = glBind(plan.command.name, renderDescriptorList(descriptors), tVoid);

    return {
        exportName,
        binding: `const ${bindingName} = ${binding};`,
        declaration: `${jsDoc}\nexport function ${exportName}(${signature}): ${outScalar.tsAlias} {\n${body}\n}`,
    };
};

const deleteSingularAlias = (plan: CommandPlan & { isOk: true }): string | undefined => {
    if (plan.params.length !== 2) {
        return undefined;
    }

    const [countPlan, arrayPlan] = plan.params;

    if (countPlan?.kind !== "scalar") {
        return undefined;
    }

    if (arrayPlan?.kind !== "array-in") {
        return undefined;
    }

    return arrayPlan.scalar.tsAlias;
};

const deleteSingularObjectClass = (plan: CommandPlan & { isOk: true }): string | undefined => {
    const [countParam, arrayParam] = plan.command.params;

    if (countParam === undefined || arrayParam === undefined) {
        return undefined;
    }

    if (arrayParam.len !== countParam.name) {
        return undefined;
    }

    return arrayParam.objectClass;
};

const deriveDeleteSingular = (
    plan: CommandPlan & { isOk: true },
    provenance: GlSymbolProvenance,
    usedTypes: Set<string>,
    docs: GlDocContext,
): RenderedCommand | undefined => {
    if (!DELETE_FAMILY.test(plan.command.name)) {
        return undefined;
    }

    const scalarAlias = deleteSingularAlias(plan);

    if (scalarAlias === undefined) {
        return undefined;
    }

    const objectClass = deleteSingularObjectClass(plan);

    if (objectClass === undefined) {
        return undefined;
    }

    usedTypes.add(scalarAlias);
    const exportName = singularize(commandExportName(plan.command.name));

    const jsDoc = singularCommandJsDoc(
        { plan, provenance, docs },
        `Deletes one ${objectClass} object name via \`${plan.command.name}(1, ...)\`.`,
        [` * @param name - \`${scalarAlias}\`, object class \`${objectClass}\``],
    );

    return {
        exportName,
        declaration:
            `${jsDoc}\nexport function ${exportName}(name: ${scalarAlias}): void {\n` +
            `    ${plan.command.name}(1, [name]);\n}`,
    };
};

export { renderCommand, deriveGenSingular, deriveDeleteSingular, type RenderedCommand };
