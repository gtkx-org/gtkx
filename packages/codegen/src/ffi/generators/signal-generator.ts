import type { GirClass, GirParameter, GirSignal } from "@gtkx/gir";
import { normalizeClassName, toCamelCase, toValidIdentifier } from "@gtkx/gir";
import { BaseGenerator } from "./base-generator.js";

export class SignalGenerator extends BaseGenerator {
    generateSignalConnect(
        sharedLibrary: string,
        signals: GirSignal[],
        classMap: Map<string, GirClass>,
        className: string,
    ): { moduleLevel: string; method: string } {
        const methodName = "connect";

        const savedEnumCallback = this.typeMapper.getEnumUsageCallback();
        const savedRecordCallback = this.typeMapper.getRecordUsageCallback();
        this.typeMapper.setEnumUsageCallback(null);
        this.typeMapper.setRecordUsageCallback(null);
        this.typeMapper.setExternalTypeUsageCallback(null);
        this.typeMapper.setSameNamespaceClassUsageCallback(null);

        let hasBoxedSignalParams = false;
        const signalMetadata = signals.map((signal) => {
            const paramEntries = (signal.parameters ?? []).map((param) => {
                const ffiType = this.typeMapper.mapParameter(param).ffi;
                if (ffiType.type === "boxed") {
                    hasBoxedSignalParams = true;
                }
                return JSON.stringify(ffiType);
            });
            const returnTypeFfi = signal.returnType
                ? JSON.stringify(this.typeMapper.mapType(signal.returnType).ffi)
                : null;
            const returnTypePart = returnTypeFfi ? `, returnType: ${returnTypeFfi}` : "";
            return `    "${signal.name}": { params: [${paramEntries.join(", ")}]${returnTypePart} }`;
        });

        this.typeMapper.setEnumUsageCallback(savedEnumCallback);
        this.typeMapper.setRecordUsageCallback(savedRecordCallback);
        this.typeMapper.setExternalTypeUsageCallback((usage) => {
            const key = `${usage.namespace}.${usage.transformedName}`;
            this.ctx.usedExternalTypes.set(key, usage);
        });
        this.typeMapper.setSameNamespaceClassUsageCallback((clsName, originalName) => {
            this.ctx.usedSameNamespaceClasses.set(clsName, originalName);
        });

        const signalOverloads = signals.map((signal) => {
            const signalParams = signal.parameters ?? [];
            const handlerParams = [`self: ${className}`];
            for (const param of signalParams) {
                const paramName = toValidIdentifier(toCamelCase(param.name));
                const signalParamClass = this.extractSignalParamClass(param, classMap);
                if (signalParamClass) {
                    const { transformedName, originalName } = signalParamClass;
                    const dotIndex = transformedName.indexOf(".");
                    if (dotIndex !== -1) {
                        const ns = transformedName.slice(0, dotIndex);
                        const clsName = transformedName.slice(dotIndex + 1);
                        this.ctx.usedExternalTypes.set(transformedName, {
                            namespace: ns,
                            name: originalName,
                            transformedName: clsName,
                            kind: "class",
                        });
                    } else {
                        this.ctx.signalClasses.set(transformedName, originalName);
                    }
                }
                const paramType = signalParamClass?.transformedName ?? this.typeMapper.mapType(param.type).ts;
                handlerParams.push(`${paramName}: ${paramType}`);
            }
            const returnType = signal.returnType ? this.typeMapper.mapType(signal.returnType).ts : "void";
            return `  ${methodName}(signal: "${signal.name}", handler: (${handlerParams.join(", ")}) => ${returnType}, after?: boolean): number;`;
        });

        const hasNotifySignal = signals.some((s) => s.name === "notify");
        if (!hasNotifySignal && this.options.namespace !== "GObject") {
            signalOverloads.push(
                `  ${methodName}(signal: "notify", handler: (self: ${className}, pspec: GObject.ParamSpec) => void, after?: boolean): number;`,
            );
            this.ctx.usedExternalTypes.set("GObject.ParamSpec", {
                namespace: "GObject",
                name: "ParamSpec",
                transformedName: "ParamSpec",
                kind: "class",
            });
        }

        signalOverloads.push(
            `  ${methodName}(signal: string, handler: (...args: any[]) => any, after?: boolean): number;`,
        );

        this.ctx.usesType = true;
        this.ctx.usesGetNativeObject = true;
        if (signalMetadata.length > 0) {
            this.ctx.usesSignalMeta = true;
        }
        if (hasBoxedSignalParams) {
            this.ctx.usesGetClassByTypeName = true;
        }

        const moduleLevel =
            signalMetadata.length > 0 ? `const SIGNAL_META: SignalMeta = {\n${signalMetadata.join(",\n")}\n};\n` : "";

        const signalMapCode =
            signalMetadata.length > 0
                ? `const meta = SIGNAL_META[signal];
    const selfType: Type = { type: "gobject", borrowed: true };
    const argTypes = meta ? [selfType, ...meta.params] : [selfType];
    const returnType = meta?.returnType;`
                : `const selfType: Type = { type: "gobject", borrowed: true };\n    const argTypes = [selfType];\n    const returnType = undefined;`;

        const boxedHandling = hasBoxedSignalParams
            ? `
        if (m.type === "boxed" && signalArgs[i] != null) {
          const cls = getNativeClass(m.innerType);
          return cls ? getNativeObject(signalArgs[i], cls) : signalArgs[i];
        }`
            : "";

        const wrapperCode =
            signalMetadata.length > 0
                ? `const wrappedHandler = (...args: unknown[]) => {
      const self = getNativeObject(args[0]);
      const signalArgs = args.slice(1);
      if (!meta) return handler(self, ...signalArgs);
      const wrapped = meta.params.map((m, i) => {
        if (m.type === "gobject" && signalArgs[i] != null) {
          return getNativeObject(signalArgs[i]);
        }${boxedHandling}
        return signalArgs[i];
      });
      return handler(self, ...wrapped);
    };`
                : `const wrappedHandler = (...args: unknown[]) => {
      const self = getNativeObject(args[0]);
      return handler(self, ...args.slice(1));
    };`;

        const overloadsSection = signalOverloads.length > 0 ? `${signalOverloads.join("\n")}\n` : "";

        const method = `${overloadsSection}  ${methodName}(
    signal: string,
    handler: (...args: any[]) => any,
    after = false
  ): number {
    ${signalMapCode}
    ${wrapperCode}
    return call(
      "${sharedLibrary}",
      "g_signal_connect_closure",
      [
        { type: { type: "gobject" }, value: this.id },
        { type: { type: "string" }, value: signal },
        { type: { type: "callback", argTypes, returnType }, value: wrappedHandler },
        { type: { type: "boolean" }, value: after },
      ],
      { type: "int", size: 64, unsigned: true }
    ) as number;
  }
`;

        return { moduleLevel, method };
    }

    private extractSignalParamClass(
        param: GirParameter,
        classMap: Map<string, GirClass>,
    ): { transformedName: string; originalName: string } | undefined {
        const typeName = param.type.name;
        if (!typeName) return undefined;

        if (typeName.includes(".")) {
            const [ns, className] = typeName.split(".", 2);
            if (!className) return undefined;

            if (this.options.typeRegistry) {
                const registered = this.options.typeRegistry.resolve(typeName);
                if (!registered || (registered.kind !== "class" && registered.kind !== "interface")) {
                }
            }

            const normalizedName = normalizeClassName(className, ns);
            if (ns === this.options.namespace) {
                return { transformedName: normalizedName, originalName: className };
            }
            return { transformedName: `${ns}.${normalizedName}`, originalName: className };
        }

        const normalizedName = normalizeClassName(typeName, this.options.namespace);
        if (classMap.has(typeName) || classMap.has(normalizedName)) {
            return { transformedName: normalizedName, originalName: typeName };
        }
    }
}
