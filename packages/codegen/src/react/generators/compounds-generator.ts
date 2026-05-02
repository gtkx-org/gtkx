/**
 * Compounds Generator
 *
 * Generates compound React components from widget metadata.
 * Each compound wraps a JSX intrinsic element with slot extraction,
 * container-slot children, virtual children, menu children, or
 * navigation page children — wired automatically from GIR metadata
 * and codegen config.
 */

import type { FileBuilder } from "../../builders/index.js";
import { raw } from "../../builders/index.js";
import type { CodegenControllerMeta } from "../../core/codegen-metadata.js";
import {
    type CompoundChildrenConfig,
    getCompoundChildren,
    getContainerMethodNames,
    getRenderableSlotNames,
} from "../../core/config/index.js";
import { formatJsDoc } from "../../core/utils/doc-formatter.js";
import { toCamelCase, toPascalCase } from "../../core/utils/naming.js";
import type { MetadataReader } from "../metadata-reader.js";

const LIST_WIDGET_NAMES = new Set(["GtkListView", "GtkGridView", "GtkColumnView", "GtkDropDown", "AdwComboRow"]);

const MENU_SUB_COMPONENTS = [
    { sub: "MenuItem", props: "MenuItemProps" },
    { sub: "MenuSection", props: "MenuSectionProps" },
    { sub: "MenuSubmenu", props: "MenuSubmenuProps" },
];

type CompoundEntry = {
    jsxName: string;
    namespace: string;
    className: string;
    doc: string | undefined;
    renderableSlots: readonly string[];
    containerMethods: readonly string[];
    children: CompoundChildrenConfig | null;
};

export class CompoundsGenerator {
    private readonly compounds: CompoundEntry[] = [];

    constructor(
        private readonly reader: MetadataReader,
        private readonly controllers: readonly CodegenControllerMeta[],
        private readonly namespaceNames: string[],
    ) {}

    generate(file: FileBuilder): void {
        this.collectCompounds();

        if (this.compounds.length === 0) return;

        this.addImports(file);

        for (const compound of this.compounds) {
            this.emitCompound(file, compound);
        }

        this.emitContainerSlotNamesType(file);
    }

    getCompoundJsxNames(): Set<string> {
        this.collectCompounds();
        return new Set(this.compounds.map((c) => c.jsxName));
    }

    private collectCompounds(): void {
        if (this.compounds.length > 0) return;

        for (const meta of this.reader.getAllCodegenMeta()) {
            if (!this.namespaceNames.includes(meta.namespace)) continue;
            if (LIST_WIDGET_NAMES.has(meta.jsxName)) continue;

            const renderableSlots = [...getRenderableSlotNames(meta.jsxName)];
            const containerMethods = [...getContainerMethodNames(meta.jsxName)];
            const children = getCompoundChildren(meta.jsxName);

            if (renderableSlots.length === 0 && containerMethods.length === 0 && !children) continue;

            this.compounds.push({
                jsxName: meta.jsxName,
                namespace: meta.namespace,
                className: meta.className,
                doc: meta.doc,
                renderableSlots,
                containerMethods,
                children,
            });
        }

        for (const meta of this.controllers) {
            if (!this.namespaceNames.includes(meta.namespace)) continue;
            const children = getCompoundChildren(meta.jsxName);
            if (!children) continue;

            this.compounds.push({
                jsxName: meta.jsxName,
                namespace: meta.namespace,
                className: meta.className,
                doc: meta.doc,
                renderableSlots: [],
                containerMethods: [],
                children,
            });
        }

        this.compounds.sort((a, b) => a.jsxName.localeCompare(b.jsxName));
    }

    private addCompoundImports(file: FileBuilder): void {
        const needsContainerSlot = this.compounds.some((c) => c.containerMethods.length > 0);
        const needsVirtualChild = this.compounds.some((c) => c.children?.virtualChildren || c.children?.menuHost);
        const needsNavPage = this.compounds.some((c) => c.children?.navigationPages);

        const compoundImports: string[] = [];
        if (needsContainerSlot) compoundImports.push("createContainerSlotChild");
        if (needsVirtualChild) compoundImports.push("createVirtualChild");
        if (needsNavPage) compoundImports.push("createNavigationPageChild");

        if (compoundImports.length > 0) {
            file.addImport("../components/compound.js", compoundImports);
        }
    }

    private collectManualPropsTypes(): Set<string> {
        const manualPropsTypes = new Set<string>();
        for (const compound of this.compounds) {
            this.collectCompoundPropsTypes(compound, manualPropsTypes);
        }
        return manualPropsTypes;
    }

    private collectCompoundPropsTypes(compound: CompoundEntry, target: Set<string>): void {
        const children = compound.children;
        if (!children) return;
        for (const vc of children.virtualChildren ?? []) {
            target.add(vc.props);
        }
        if (children.menuHost) {
            for (const mc of MENU_SUB_COMPONENTS) {
                target.add(mc.props);
            }
        }
        for (const np of children.navigationPages ?? []) {
            target.add(np.props);
        }
    }

    private addImports(file: FileBuilder): void {
        file.addTypeImport("react", ["ReactNode"]);
        file.addImport("../components/slot-widget.js", ["createSlotWidget"]);

        this.addCompoundImports(file);

        const generatedPropsTypes = this.compounds.map((compound) => `${compound.jsxName}Props`);
        if (generatedPropsTypes.length > 0) {
            file.addTypeImport("./jsx.js", generatedPropsTypes);
        }

        const manualPropsTypes = this.collectManualPropsTypes();
        if (manualPropsTypes.size > 0) {
            file.addTypeImport(
                "../jsx.js",
                [...manualPropsTypes].sort((a, b) => a.localeCompare(b)),
            );
        }
    }

    private emitCompound(file: FileBuilder, compound: CompoundEntry): void {
        const { jsxName, namespace, className, doc: rawDoc, renderableSlots } = compound;
        const propsType = `${jsxName}Props`;

        const doc = formatJsDoc(rawDoc, namespace) ?? `A ${namespace}.${className} widget element.`;

        const subComponents = this.collectSubComponents(compound);

        if (subComponents.length === 0) {
            file.add(
                raw(
                    `${formatJsDocBlock(doc)}` +
                        `export const ${jsxName}: (props: ${propsType}) => ReactNode = ` +
                        `createSlotWidget<${propsType}>("${jsxName}", ${JSON.stringify(renderableSlots)});\n`,
                ),
            );
            return;
        }

        const typeEntries = subComponents
            .map((sc) => `    ${sc.name}: (props: ${sc.propsType}) => ReactNode;`)
            .join("\n");

        const assignEntries = subComponents.map((sc) => `    ${sc.name}: ${sc.factory},`).join("\n");

        file.add(
            raw(
                `${formatJsDocBlock(doc)}` +
                    `export const ${jsxName}: ((props: ${propsType}) => ReactNode) & {\n` +
                    `${typeEntries}\n` +
                    `} = Object.assign(createSlotWidget<${propsType}>("${jsxName}", ${JSON.stringify(renderableSlots)}), {\n` +
                    `${assignEntries}\n` +
                    `});\n`,
            ),
        );
    }

    private collectSubComponents(compound: CompoundEntry): Array<{ name: string; propsType: string; factory: string }> {
        const subs: Array<{ name: string; propsType: string; factory: string }> = [];

        for (const methodKebab of compound.containerMethods) {
            const camel = toCamelCase(methodKebab);
            const pascal = toPascalCase(methodKebab);
            subs.push({
                name: pascal,
                propsType: "{ children?: ReactNode }",
                factory: `createContainerSlotChild("${camel}")`,
            });
        }

        if (compound.children?.virtualChildren) {
            for (const vc of compound.children.virtualChildren) {
                subs.push({
                    name: vc.sub,
                    propsType: vc.props,
                    factory: `createVirtualChild<${vc.props}>("${vc.intrinsic}")`,
                });
            }
        }

        if (compound.children?.menuHost) {
            for (const mc of MENU_SUB_COMPONENTS) {
                subs.push({
                    name: mc.sub,
                    propsType: mc.props,
                    factory: `createVirtualChild<${mc.props}>("${mc.sub}")`,
                });
            }
        }

        if (compound.children?.navigationPages) {
            for (const np of compound.children.navigationPages) {
                subs.push({
                    name: np.sub,
                    propsType: np.props,
                    factory: `createNavigationPageChild<${np.props}>("${np.forValue}")`,
                });
            }
        }

        return subs;
    }

    private emitContainerSlotNamesType(file: FileBuilder): void {
        const entries: string[] = [];

        for (const compound of this.compounds) {
            if (compound.containerMethods.length === 0) continue;
            const methods = compound.containerMethods.map((m) => `"${toCamelCase(m)}"`).join(" | ");
            entries.push(`    ${compound.jsxName}: ${methods};`);
        }

        if (entries.length === 0) return;

        file.add(
            raw(
                `/**\n` +
                    ` * Type mapping widgets to their valid container slot method names.\n` +
                    ` *\n` +
                    ` * Each key is a JSX element name and each value is a union of method names\n` +
                    ` * used by container slot compound components (e.g. \`AdwHeaderBar.PackStart\`).\n` +
                    ` */\n` +
                    `export type ContainerSlotNames = {\n` +
                    `${entries.join("\n")}\n` +
                    `};\n`,
            ),
        );
    }
}

function formatJsDocBlock(doc: string): string {
    const lines = doc.split("\n");
    if (lines.length === 1) {
        return `/** ${lines[0]} */\n`;
    }

    const body = lines.map((line) => (line.length > 0 ? ` * ${line}` : " *")).join("\n");
    return `/**\n${body}\n */\n`;
}
