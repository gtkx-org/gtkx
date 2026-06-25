import { toCamelIdentifier } from "@gtkx/utils";
import type { InArg, OutArg } from "./args.js";
import type { ReturnPlan } from "./ctype.js";
import type { GlCommand } from "./model.js";

export const REFPAGES_BASE = "https://registry.khronos.org/OpenGL-Refpages/gl4/html";

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
    if (param.kind !== undefined) notes.push(`object kind \`${param.kind}\``);
    return ` * @param ${arg.name} - ${notes.join(", ")}`;
};

const returnsDocLine = (command: GlCommand, returnPlan: ReturnPlan, outs: OutArg[]): string | undefined => {
    const members: string[] = [];
    if (returnPlan.kind !== "void") members.push(`\`${command.returnCType}\``);
    for (const out of outs) members.push(`\`${out.docName}\` (\`${out.docCType}\`)`);
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

export const commandJsDoc = ({ command, feature, ins, outs, returnPlan }: CommandJsDocOptions): string => {
    const lines = ["/**", ` * \`${formatPrototype(command)}\``, " *", ` * Provided by \`${feature}\`.`];
    if (ins.length > 0) {
        lines.push(" *");
        for (const arg of ins) lines.push(inParamDocLine(command, arg));
    }
    const returnsLine = returnsDocLine(command, returnPlan, outs);
    if (returnsLine !== undefined) lines.push(returnsLine);
    lines.push(` * @see ${REFPAGES_BASE}/${command.name}.xhtml`);
    lines.push(" */");
    return lines.join("\n");
};
