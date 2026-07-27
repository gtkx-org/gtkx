import { toCamelIdentifier } from "@gtkx/utils";
import type { InArg, OutArg } from "./args.js";
import type { GlCommand } from "./model.js";
import type { ReturnPlan } from "./plan.js";

type CommandJsDocOptions = {
    command: GlCommand;
    feature: string;
    ins: InArg[];
    outs: OutArg[];
    returnPlan: ReturnPlan;
};

type SingularJsDocOptions = {
    commandName: string;
    feature: string;
    summary: string;
    body: string[];
};

const REFPAGES_BASE = "https://registry.khronos.org/OpenGL-Refpages/gl4/html";

const formatPrototype = (command: GlCommand): string => {
    const params = command.params
        .map((param) => (param.cType.endsWith("*") ? `${param.cType}${param.name}` : `${param.cType} ${param.name}`))
        .join(", ");

    return `${command.returnCType} ${command.name}(${params})`;
};

const inParamDocLine = (command: GlCommand, arg: InArg): string => {
    const param = command.params.find((candidate) => toCamelIdentifier(candidate.name) === arg.name);

    if (param === undefined) {
        return ` * @param ${arg.name}`;
    }

    const notes: string[] = [`\`${param.cType}\``];

    if (param.group !== undefined) {
        notes.push(`group \`${param.group}\``);
    }

    if (param.len !== undefined) {
        notes.push(`length \`${param.len}\``);
    }

    if (param.objectClass !== undefined) {
        notes.push(`object class \`${param.objectClass}\``);
    }

    return ` * @param ${arg.name} - ${notes.join(", ")}`;
};

const outMember = (command: GlCommand, out: OutArg): string => {
    const param = command.params[out.paramIndex];

    if (param === undefined) {
        throw new Error(`Output parameter index ${String(out.paramIndex)} out of range on ${command.name}`);
    }

    return `\`${param.name}\` (\`${param.cType}\`)`;
};

const returnsDocLine = (command: GlCommand, returnPlan: ReturnPlan, outs: OutArg[]): string | undefined => {
    const members: string[] = [];

    if (returnPlan.kind !== "void") {
        members.push(`\`${command.returnCType}\``);
    }

    for (const out of outs) {
        members.push(outMember(command, out));
    }

    if (members.length === 0) {
        return undefined;
    }

    const [single] = members;

    if (single !== undefined && members.length === 1) {
        return ` * @returns ${single}`;
    }

    return ` * @returns Tuple of ${members.join(", ")}`;
};

const singularJsDoc = ({ commandName, feature, summary, body }: SingularJsDocOptions): string =>
    [
        "/**",
        ` * ${summary}`,
        " *",
        ` * Provided by \`${feature}\`.`,
        ...body,
        ` * @see ${REFPAGES_BASE}/${commandName}.xhtml`,
        " */",
    ].join("\n");

const commandJsDoc = ({ command, feature, ins, outs, returnPlan }: CommandJsDocOptions): string => {
    const returnsLine = returnsDocLine(command, returnPlan, outs);

    return singularJsDoc({
        commandName: command.name,
        feature,
        summary: `\`${formatPrototype(command)}\``,
        body: [
            ...(ins.length > 0 ? [" *", ...ins.map((arg) => inParamDocLine(command, arg))] : []),
            ...(returnsLine === undefined ? [] : [returnsLine]),
        ],
    });
};

export { inParamDocLine, singularJsDoc, commandJsDoc };
