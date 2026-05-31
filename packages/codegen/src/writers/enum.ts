import type { ModuleContext } from "../dsl/context.js";
import type { GirEnum } from "../gir/enum.js";
import { pascalCase, quote } from "@gtkx/utils";

/**
 * Emits the runtime declaration for an `<enumeration>` or `<bitfield>`.
 *
 * Two branches:
 * - `glib:error-domain` present → `export type Name = number` plus
 *   `makeErrorDomain(quark, members)` typed as `ErrorDomain<{ members }>`,
 *   since the domain object must stay `instanceof`-matchable.
 * - GLib-registered enum/flags or C-only enum (no GLib registration) →
 *   a TypeScript `enum Name { members }` declaration.
 *
 * Member names are derived from the GIR `name` attribute, uppercased with
 * hyphens normalized to underscores. Names that would start with a digit
 * (e.g. `5_6_5` → `_5_6_5`) are prefixed with an underscore.
 *
 * @param ctx - The module context
 * @param enumeration - The enum to emit
 */
export const emitEnum = (ctx: ModuleContext, enumeration: GirEnum): void => {
    if (!enumeration.introspectable) return;
    const name = pascalCase(enumeration.name);
    const memberKeys = enumeration.members.map((member) => memberKey(member.name));
    if (enumeration.errorDomain !== undefined) {
        const memberEntries = enumeration.members.map((member, index) => `${memberKeys[index]}: ${member.value}`);
        const typeFields = memberKeys.map((key) => `readonly ${key}: number`).join("; ");
        ctx.addRuntimeImport("makeErrorDomain");
        ctx.addRuntimeImport("ErrorDomain");
        const quarkExpression = quarkExpression_(ctx, enumeration.errorDomain);
        ctx.module.appendDeclaration(`export type ${name} = number;`);
        ctx.module.appendDeclaration(
            `export const ${name}: ErrorDomain<{ ${typeFields} }> = makeErrorDomain(${quarkExpression}, { ${memberEntries.join(", ")} });`,
        );
        return;
    }
    const memberDeclarations = enumeration.members.map((member, index) => `${memberKeys[index]} = ${member.value}`);
    ctx.module.appendDeclaration(`export enum ${name} { ${memberDeclarations.join(", ")} }`);
};

const memberKey = (name: string): string => {
    const upper = name.toUpperCase().replaceAll("-", "_");
    return /^[0-9]/.test(upper) ? `_${upper}` : upper;
};

const quarkExpression_ = (ctx: ModuleContext, errorDomain: string): string => {
    if (ctx.namespace.name === "GLib") {
        return `() => quarkFromString(${quote(errorDomain)})`;
    }
    const alias = ctx.addCrossNamespaceImport("GLib");
    return `() => ${alias}.quarkFromString(${quote(errorDomain)})`;
};
