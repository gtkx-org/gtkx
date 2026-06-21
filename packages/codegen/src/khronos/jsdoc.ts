import { toCamelIdentifier } from "@gtkx/utils";
import type { ReturnPlan } from "./ctype.js";
import type { GlCommand } from "./model.js";
import type { EmittedIn, EmittedOut } from "./slots.js";

export const REFPAGES_BASE = "https://registry.khronos.org/OpenGL-Refpages/gl4/html";

const formatPrototype = (command: GlCommand): string => {
    const params = command.params
        .map((param) => (param.cType.endsWith("*") ? `${param.cType}${param.name}` : `${param.cType} ${param.name}`))
        .join(", ");
    return `${command.returnCType} ${command.name}(${params})`;
};

export const inParamDocLine = (command: GlCommand, slot: EmittedIn): string => {
    const param = command.params.find((candidate) => toCamelIdentifier(candidate.name) === slot.name);
    if (param === undefined) return ` * @param ${slot.name}`;
    const notes: string[] = [`\`${param.cType}\``];
    if (param.group !== undefined) notes.push(`group \`${param.group}\``);
    if (param.len !== undefined) notes.push(`length \`${param.len}\``);
    if (param.kind !== undefined) notes.push(`object kind \`${param.kind}\``);
    return ` * @param ${slot.name} - ${notes.join(", ")}`;
};

const returnsDocLine = (command: GlCommand, returnPlan: ReturnPlan, outs: EmittedOut[]): string | undefined => {
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
    ins: EmittedIn[];
    outs: EmittedOut[];
    returnPlan: ReturnPlan;
};

export const commandJsDoc = ({ command, feature, ins, outs, returnPlan }: CommandJsDocOptions): string => {
    const lines = ["/**", ` * \`${formatPrototype(command)}\``, " *", ` * Provided by \`${feature}\`.`];
    if (ins.length > 0) {
        lines.push(" *");
        for (const slot of ins) lines.push(inParamDocLine(command, slot));
    }
    const returnsLine = returnsDocLine(command, returnPlan, outs);
    if (returnsLine !== undefined) lines.push(returnsLine);
    lines.push(` * @see ${REFPAGES_BASE}/${command.name}.xhtml`);
    lines.push(" */");
    return lines.join("\n");
};
