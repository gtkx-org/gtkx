import type { WriterFunction } from "ts-morph";
import type { MappedType } from "../type-system/ffi-types.js";

export type ParamWrapInfo = {
    needsWrap: boolean;
    needsTargetClass: boolean;
    targetClass: string | undefined;
    tsType: string;
};

export type ReturnUnwrapInfo = {
    needsUnwrap: boolean;
};

export type CallbackWrapperOptions = {
    paramWrapInfos: Array<{ wrapInfo: ParamWrapInfo }>;
    returnUnwrapInfo?: ReturnUnwrapInfo;
};

export class ParamWrapWriter {
    needsReturnUnwrap(mappedType: MappedType | null): ReturnUnwrapInfo {
        if (!mappedType) {
            return { needsUnwrap: false };
        }
        const ffiType = mappedType.ffi.type;
        const needsUnwrap = ffiType === "gobject" || ffiType === "boxed" || ffiType === "struct";
        return { needsUnwrap };
    }
    needsParamWrap(mappedType: MappedType): ParamWrapInfo {
        const ffiType = mappedType.ffi.type;
        const tsType = mappedType.ts;

        if (ffiType === "gobject" && mappedType.kind !== "interface") {
            return {
                needsWrap: true,
                needsTargetClass: false,
                targetClass: undefined,
                tsType,
            };
        }

        const needsTargetClass =
            (ffiType === "gobject" && mappedType.kind === "interface") ||
            ffiType === "boxed" ||
            ffiType === "struct" ||
            ffiType === "gvariant" ||
            ffiType === "gparam";

        if (needsTargetClass) {
            return {
                needsWrap: true,
                needsTargetClass: true,
                targetClass: mappedType.ts,
                tsType,
            };
        }

        return {
            needsWrap: false,
            needsTargetClass: false,
            targetClass: undefined,
            tsType,
        };
    }

    writeWrapExpression(argName: string, wrapInfo: ParamWrapInfo): string {
        if (!wrapInfo.needsWrap) {
            return `${argName} as ${wrapInfo.tsType}`;
        }

        if (wrapInfo.needsTargetClass && wrapInfo.targetClass) {
            return `getNativeObject(${argName}, ${wrapInfo.targetClass})!`;
        }

        return `getNativeObject(${argName}) as ${wrapInfo.tsType}`;
    }

    buildWrapParamsFunction(params: Array<{ mappedType: MappedType; paramName: string }>): WriterFunction | null {
        const wrapInfos = params.map((p) => ({
            ...p,
            wrapInfo: this.needsParamWrap(p.mappedType),
        }));

        const anyNeedsWrap = wrapInfos.some((w) => w.wrapInfo.needsWrap);
        if (!anyNeedsWrap) {
            return null;
        }

        return (writer) => {
            writer.write("(args: unknown[]) => [");
            writer.newLine();
            writer.indent(() => this.writeWrapExpressionsList(wrapInfos, writer));
            writer.write("]");
        };
    }

    buildCallbackWrapperExpression(
        jsParamName: string,
        wrapInfos: Array<{ wrapInfo: ParamWrapInfo }>,
        returnUnwrapInfo?: ReturnUnwrapInfo,
    ): WriterFunction {
        return (writer) => {
            writer.write(`${jsParamName}`);
            writer.newLine();
            writer.indent(() => {
                writer.write("? (...args: unknown[]) => ");
                if (returnUnwrapInfo?.needsUnwrap) {
                    writer.write("{");
                    writer.newLine();
                    writer.indent(() => {
                        writer.write(`const _result = ${jsParamName}(`);
                        writer.newLine();
                        writer.indent(() => this.writeWrapExpressionsList(wrapInfos, writer));
                        writer.writeLine(");");
                        writer.writeLine("return _result?.id ?? null;");
                    });
                    writer.write("}");
                } else {
                    writer.write(`${jsParamName}(`);
                    writer.newLine();
                    writer.indent(() => this.writeWrapExpressionsList(wrapInfos, writer));
                    writer.write(")");
                }
                writer.newLine();
                writer.write(": null");
            });
        };
    }

    private writeWrapExpressionsList(
        wrapInfos: Array<{ wrapInfo: ParamWrapInfo }>,
        writer: import("ts-morph").CodeBlockWriter,
    ): void {
        wrapInfos.forEach((w, index) => {
            const argAccess = `args[${index}]`;
            const expression = this.writeWrapExpression(argAccess, w.wrapInfo);
            writer.write(expression);
            if (index < wrapInfos.length - 1) {
                writer.write(",");
            }
            writer.newLine();
        });
    }
}
