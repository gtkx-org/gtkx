import type { Writer } from "../../builders/writer.js";
import type { MappedType } from "../type-system/ffi-types.js";

export type ParamWrapInfo = {
    needsWrap: boolean;
    needsTargetClass: boolean;
    targetClass: string | undefined;
    isInterface: boolean;
    tsType: string;
};

export type ReturnUnwrapInfo = {
    needsUnwrap: boolean;
};

export function needsReturnUnwrap(mappedType: MappedType | null): ReturnUnwrapInfo {
    if (!mappedType) return { needsUnwrap: false };
    const ffiType = mappedType.ffi.type;
    return { needsUnwrap: ffiType === "gobject" || ffiType === "boxed" || ffiType === "struct" };
}

export function needsParamWrap(mappedType: MappedType): ParamWrapInfo {
    const ffiType = mappedType.ffi.type;
    const tsType = mappedType.ts;

    if (ffiType === "gobject" && mappedType.kind !== "interface") {
        return { needsWrap: true, needsTargetClass: false, targetClass: undefined, isInterface: false, tsType };
    }

    const isInterface = ffiType === "gobject" && mappedType.kind === "interface";
    const needsTargetClass = isInterface || ffiType === "boxed" || ffiType === "struct" || ffiType === "fundamental";

    if (needsTargetClass) {
        return { needsWrap: true, needsTargetClass: true, targetClass: mappedType.ts, isInterface, tsType };
    }

    return { needsWrap: false, needsTargetClass: false, targetClass: undefined, isInterface: false, tsType };
}

export function writeWrapExpression(argName: string, wrapInfo: ParamWrapInfo): string {
    if (!wrapInfo.needsWrap) {
        return `${argName} as ${wrapInfo.tsType}`;
    }
    if (wrapInfo.needsTargetClass && wrapInfo.targetClass) {
        if (wrapInfo.isInterface) {
            return `getNativeObjectAsInterface(${argName} as NativeHandle, ${wrapInfo.targetClass})`;
        }
        return `getNativeObject(${argName} as NativeHandle, ${wrapInfo.targetClass})`;
    }
    return `getNativeObject(${argName} as NativeHandle) as ${wrapInfo.tsType}`;
}

function writeUnwrappedCallbackBody(
    writer: Writer,
    jsParamName: string,
    wrapInfos: Array<{ wrapInfo: ParamWrapInfo }>,
): void {
    writer.write("{");
    writer.newLine();
    writer.withIndent(() => {
        writer.write(`const _result = ${jsParamName}(`);
        writer.newLine();
        writer.withIndent(() => writeWrapExpressionsList(wrapInfos, writer));
        writer.writeLine(");");
        writer.writeLine("return _result?.handle ?? null;");
    });
    writer.write("}");
}

function writeDirectCallbackBody(
    writer: Writer,
    jsParamName: string,
    wrapInfos: Array<{ wrapInfo: ParamWrapInfo }>,
): void {
    writer.write(`${jsParamName}(`);
    writer.newLine();
    writer.withIndent(() => writeWrapExpressionsList(wrapInfos, writer));
    writer.write(")");
}

export function buildCallbackWrapperExpression(
    jsParamName: string,
    wrapInfos: Array<{ wrapInfo: ParamWrapInfo }>,
    returnUnwrapInfo?: ReturnUnwrapInfo,
): (writer: Writer) => void {
    return (writer) => {
        writer.write(`${jsParamName}`);
        writer.newLine();
        writer.withIndent(() => {
            writer.write("? (...args: unknown[]) => ");
            if (returnUnwrapInfo?.needsUnwrap) {
                writeUnwrappedCallbackBody(writer, jsParamName, wrapInfos);
            } else {
                writeDirectCallbackBody(writer, jsParamName, wrapInfos);
            }
            writer.newLine();
            writer.write(": null");
        });
    };
}

function writeWrapExpressionsList(wrapInfos: Array<{ wrapInfo: ParamWrapInfo }>, writer: Writer): void {
    wrapInfos.forEach((w, index) => {
        const argAccess = `args[${index}]`;
        writer.write(writeWrapExpression(argAccess, w.wrapInfo));
        if (index < wrapInfos.length - 1) writer.write(",");
        writer.newLine();
    });
}
