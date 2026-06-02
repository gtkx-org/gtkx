import { quote } from "@gtkx/utils";
import type { ModuleContext } from "../dsl/context.js";
import type { GirEnum } from "../gir/enum.js";

/**
 * Emits the runtime declaration for an `<enumeration>` or `<bitfield>`.
 *
 * Two branches:
 * - `glib:error-domain` present → `export type Name = number` plus
 *   `createErrorDomain(quark, members)` typed as `ErrorDomain<{ members }>`,
 *   since the domain object must stay `instanceof`-matchable.
 * - GLib-registered enum/flags or C-only enum (no GLib registration) →
 *   a TypeScript `enum Name { members }` declaration.
 *
 * Member names are derived from the GIR `name` attribute, uppercased with
 * hyphens normalized to underscores. Names that would start with a digit
 * (e.g. `5_6_5` → `_5_6_5`) are prefixed with an underscore.
 *
 * @param context - The module context
 * @param enumeration - The enum to emit
 */
export const emitEnum = (context: ModuleContext, enumeration: GirEnum): void => {
    if (!enumeration.introspectable) return;
    const name = enumeration.name;
    const memberKeys = enumeration.members.map((member) => memberKey(member.name));
    if (enumeration.errorDomain !== undefined) {
        const memberEntries = enumeration.members.map((member, index) => `${memberKeys[index]}: ${member.value}`);
        const typeFields = memberKeys.map((key) => `readonly ${key}: number`).join("; ");
        context.addRuntimeImport("createErrorDomain");
        context.addRuntimeImport("ErrorDomain");
        const quarkExpression = renderQuarkExpression(context, enumeration.errorDomain);
        context.module.appendDeclaration(`export type ${name} = number;`);
        context.module.appendDeclaration(
            `export const ${name}: ErrorDomain<{ ${typeFields} }> = createErrorDomain(${quarkExpression}, { ${memberEntries.join(", ")} });`,
        );
        return;
    }
    const memberDeclarations = enumeration.members.map((member, index) => `${memberKeys[index]} = ${member.value}`);
    context.module.appendDeclaration(`export enum ${name} { ${memberDeclarations.join(", ")} }`);
};

const memberKey = (name: string): string => {
    const upper = name.toUpperCase().replaceAll("-", "_");
    return /^[0-9]/.test(upper) ? `_${upper}` : upper;
};

const renderQuarkExpression = (context: ModuleContext, errorDomain: string): string => {
    if (context.namespace.name === "GLib") {
        return `() => quarkFromString(${quote(errorDomain)})`;
    }
    const alias = context.addCrossNamespaceImport("GLib");
    return `() => ${alias}.quarkFromString(${quote(errorDomain)})`;
};
