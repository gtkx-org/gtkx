import type { GirFunction } from "@gtkx/gir";
import { toCamelCase, toValidIdentifier } from "@gtkx/gir";
import { BaseGenerator } from "./base-generator.js";

export class FunctionGenerator extends BaseGenerator {
    async generateFunctions(functions: GirFunction[], sharedLibrary: string): Promise<string> {
        const supportedFunctions = functions.filter((f) => !this.hasUnsupportedCallbacks(f.parameters));

        this.ctx.usesRef = supportedFunctions.some((f) => this.hasRefParameter(f.parameters));
        this.ctx.usesCall = supportedFunctions.length > 0;

        const sections: string[] = [];

        for (const func of supportedFunctions) {
            sections.push(this.generateFunction(func, sharedLibrary));
        }

        return sections.join("\n");
    }

    private generateFunction(func: GirFunction, sharedLibrary: string): string {
        const funcName = toValidIdentifier(toCamelCase(func.name));
        const params = this.generateParameterList(func.parameters);
        const returnTypeMapping = this.typeMapper.mapType(func.returnType, true);
        const isNullable = func.returnType.nullable === true;
        const baseReturnType = returnTypeMapping.ts;
        const fullReturnType = isNullable && baseReturnType !== "void" ? `${baseReturnType} | null` : baseReturnType;
        const tsReturnType = fullReturnType === "void" ? "" : `: ${fullReturnType}`;

        const hasResultParam = func.parameters.some((p) => toValidIdentifier(toCamelCase(p.name)) === "result");
        const resultVarName = hasResultParam ? "_result" : "result";

        const needsGObjectWrap =
            returnTypeMapping.ffi.type === "gobject" &&
            returnTypeMapping.ts !== "unknown" &&
            returnTypeMapping.kind !== "interface";
        const needsBoxedWrap =
            returnTypeMapping.ffi.type === "boxed" &&
            returnTypeMapping.ts !== "unknown" &&
            returnTypeMapping.kind !== "interface";
        const needsGVariantWrap = returnTypeMapping.ffi.type === "gvariant" && returnTypeMapping.ts !== "unknown";
        const needsInterfaceWrap =
            returnTypeMapping.ffi.type === "gobject" &&
            returnTypeMapping.ts !== "unknown" &&
            returnTypeMapping.kind === "interface";
        const needsObjectWrap = needsGObjectWrap || needsBoxedWrap || needsGVariantWrap || needsInterfaceWrap;
        const hasReturnValue = returnTypeMapping.ts !== "void";

        const gtkAllocatesRefs = this.identifyGtkAllocatesRefs(func.parameters);

        const lines: string[] = [];
        const funcDoc = this.formatMethodDoc(func.doc, func.parameters, "");
        if (funcDoc) {
            lines.push(funcDoc.trimEnd());
        }
        lines.push(`export const ${funcName} = (${params})${tsReturnType} => {`);

        if (func.throws) {
            lines.push(`  const error = { value: null as unknown };`);
        }

        const args = this.generateCallArguments(func.parameters, "  ");
        const errorArg = func.throws ? this.generateErrorArgument("  ") : "";
        const allArgs = errorArg ? args + (args ? ",\n" : "") + errorArg : args;

        const refRewrapCode = this.generateRefRewrapCode(gtkAllocatesRefs).map((line) => line.replace(/^ {4}/, "  "));

        if (needsObjectWrap && hasReturnValue) {
            lines.push(`  const ptr = call("${sharedLibrary}", "${func.cIdentifier}", [
${allArgs ? `${allArgs},` : ""}
  ], ${this.generateTypeDescriptor(returnTypeMapping.ffi)});`);
            if (func.throws) {
                lines.push(this.generateErrorCheck(""));
            }
            lines.push(...refRewrapCode);
            if (isNullable) {
                lines.push(`  if (ptr === null) return null;`);
            }
            if (needsBoxedWrap || needsGVariantWrap || needsInterfaceWrap) {
                this.ctx.usesGetNativeObject = true;
                lines.push(`  return getNativeObject(ptr, ${baseReturnType})!;`);
            } else {
                this.ctx.usesGetNativeObject = true;
                lines.push(`  return getNativeObject(ptr) as ${baseReturnType};`);
            }
        } else {
            const hasRefRewrap = gtkAllocatesRefs.length > 0;
            const needsResultVar = func.throws || hasRefRewrap;
            const callPrefix = needsResultVar
                ? hasReturnValue
                    ? `const ${resultVarName} = `
                    : ""
                : hasReturnValue
                  ? "return "
                  : "";

            const needsCast = returnTypeMapping.ts !== "void" && returnTypeMapping.ts !== "unknown";

            lines.push(`  ${callPrefix}call("${sharedLibrary}", "${func.cIdentifier}", [
${allArgs ? `${allArgs},` : ""}
  ], ${this.generateTypeDescriptor(returnTypeMapping.ffi)})${needsCast ? ` as ${returnTypeMapping.ts}` : ""};`);

            if (func.throws) {
                lines.push(this.generateErrorCheck(""));
            }
            lines.push(...refRewrapCode);
            if (needsResultVar && hasReturnValue) {
                lines.push(`  return ${resultVarName};`);
            }
        }

        lines.push(`};`);
        return `${lines.join("\n")}\n`;
    }
}
