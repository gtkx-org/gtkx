import { toCamelIdentifier } from "@gtkx/utils";
import type { InArg, OutArg } from "./args.js";
import type { GlCommand } from "./model.js";
import type { ReturnPlan } from "./plan.js";

const REFPAGES_BASE = "https://registry.khronos.org/OpenGL-Refpages/gl4/html";

const formatPrototype = (command: GlCommand): string => {
    const params = command.params
        .map((param) => (param.cType.endsWith("*") ? `${param.cType}${param.name}` : `${param.cType} ${param.name}`))
        .join(", ");
    return `${command.returnCType} ${command.name}(${params})`;
};

export const inParamDocLine = (command: GlCommand, arg: InArg): string => {
    const param = command.params.find((candidate) => toCamelIdentifier(candidate.name) === arg.name);
    if (param === undefined) return ` * @param ${arg.name}`;
    const notes: string[] = [`\`${param.cType}\``];
    if (param.group !== undefined) notes.push(`group \`${param.group}\``);
    if (param.len !== undefined) notes.push(`length \`${param.len}\``);
    if (param.objectClass !== undefined) notes.push(`object class \`${param.objectClass}\``);
    return ` * @param ${arg.name} - ${notes.join(", ")}`;
};

const returnsDocLine = (command: GlCommand, returnPlan: ReturnPlan, outs: OutArg[]): string | undefined => {
    const members: string[] = [];
    if (returnPlan.kind !== "void") members.push(`\`${command.returnCType}\``);
    for (const out of outs) {
        const param = command.params[out.paramIndex];
        if (param === undefined)
            throw new Error(`Output parameter index ${out.paramIndex} out of range on ${command.name}`);
        members.push(`\`${param.name}\` (\`${param.cType}\`)`);
    }
    if (members.length === 0) return undefined;
    if (members.length === 1) return ` * @returns ${members[0]}`;
    return ` * @returns Tuple of ${members.join(", ")}`;
};

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

export const singularJsDoc = ({ commandName, feature, summary, body }: SingularJsDocOptions): string =>
    [
        "/**",
        ` * ${summary}`,
        " *",
        ` * Provided by \`${feature}\`.`,
        ...body,
        ` * @see ${REFPAGES_BASE}/${commandName}.xhtml`,
        " */",
    ].join("\n");

export const commandJsDoc = ({ command, feature, ins, outs, returnPlan }: CommandJsDocOptions): string => {
    const returnsLine = returnsDocLine(command, returnPlan, outs);
    return singularJsDoc({
        commandName: command.name,
        feature,
        summary: `\`${formatPrototype(command)}\``,
        body: [
            ...(ins.length > 0 ? [" *", ...ins.map((arg) => inParamDocLine(command, arg))] : []),
            ...(returnsLine !== undefined ? [returnsLine] : []),
        ],
    });
};
