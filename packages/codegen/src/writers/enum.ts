import type { ModuleContext } from "../dsl/context.js";
import { quote } from "../dsl/emit.js";
import { pascalCase } from "../dsl/identifier.js";
import type { GirEnum } from "../gir/enum.js";

/**
 * Emits the runtime declaration for an `<enumeration>` or `<bitfield>`.
 *
 * Three branches:
 * - `glib:error-domain` present → `makeErrorDomain(quark, members)` typed
 *   as `ErrorDomain<{ members }>`.
 * - GLib-registered enum/flags or C-only enum (no GLib registration) →
 *   `globalThis.Object.freeze({ members })` typed as `Readonly<{ members }>`.
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
    const memberEntries = enumeration.members.map((member, index) => `${memberKeys[index]}: ${member.value}`);
    const body = `{ ${memberEntries.join(", ")} }`;
    const typeFields = memberKeys.map((key) => `readonly ${key}: number`).join("; ");
    ctx.module.appendDeclaration(`export type ${name} = number;`);
    if (enumeration.errorDomain !== undefined) {
        ctx.addRuntimeImport("makeErrorDomain");
        ctx.addRuntimeImport("ErrorDomain");
        const quarkExpression = quarkExpression_(ctx, enumeration.errorDomain);
        ctx.module.appendDeclaration(
            `export const ${name}: ErrorDomain<{ ${typeFields} }> = makeErrorDomain(${quarkExpression}, ${body});`,
        );
        return;
    }
    ctx.module.appendDeclaration(
        `export const ${name}: Readonly<{ ${typeFields} }> = globalThis.Object.freeze(${body});`,
    );
};

const memberKey = (name: string): string => {
    const upper = name.toUpperCase().replace(/-/g, "_");
    return /^[0-9]/.test(upper) ? `_${upper}` : upper;
};

const quarkExpression_ = (ctx: ModuleContext, errorDomain: string): string => {
    if (ctx.namespace.name === "GLib") {
        return `() => quarkFromString(${quote(errorDomain)})`;
    }
    const alias = ctx.addCrossNamespaceImport("GLib");
    return `() => ${alias}.quarkFromString(${quote(errorDomain)})`;
};
