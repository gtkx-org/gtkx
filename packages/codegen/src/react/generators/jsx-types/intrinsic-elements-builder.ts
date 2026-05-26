/**
 * Intrinsic Elements Builder
 *
 * Builds JSX intrinsic elements using pre-computed metadata.
 * Uses slots from CodegenWidgetMeta (SINGLE SOURCE OF TRUTH).
 */

import type { FileBuilder } from "../../../builders/index.js";
import { raw, typeAlias, variableStatement } from "../../../builders/index.js";
import type { CodegenControllerMeta, CodegenLayoutManagerMeta } from "../../../codegen-metadata.js";
import { formatJsDoc } from "../../../utils/doc-formatter.js";
import { toCamelCase } from "../../../utils/naming.js";
import type { JsxWidget } from "./generator.js";

export class IntrinsicElementsBuilder {
    private static readonly LIST_WIDGET_NAMES = new Set([
        "GtkListView",
        "GtkGridView",
        "GtkColumnView",
        "GtkDropDown",
        "AdwComboRow",
    ]);

    /**
     * Layout managers excluded from the React surface.
     *
     * `GtkCustomLayout` is driven by virtual function overrides rather than
     * declarative props, so it has no useful JSX projection.
     */
    private static readonly EXCLUDED_LAYOUT_MANAGER_NAMES = new Set(["GtkCustomLayout"]);

    buildWidgetExports(
        file: FileBuilder,
        widgets: JsxWidget[],
        compoundJsxNames: ReadonlySet<string> = new Set(),
    ): void {
        for (const widget of widgets) {
            if (IntrinsicElementsBuilder.LIST_WIDGET_NAMES.has(widget.jsxName)) continue;
            if (compoundJsxNames.has(widget.jsxName)) continue;

            const doc =
                formatJsDoc(widget.meta.doc, widget.namespace) ??
                `A ${widget.namespace}.${widget.className} widget element.`;

            file.add(
                variableStatement(widget.jsxName, {
                    exported: true,
                    kind: "const",
                    initializer: `"${widget.jsxName}" as const`,
                    doc,
                }),
            );
        }
    }

    buildControllerExports(
        file: FileBuilder,
        controllers: CodegenControllerMeta[],
        compoundJsxNames: ReadonlySet<string> = new Set(),
    ): void {
        for (const controller of controllers) {
            if (controller.className === "EventController" || controller.abstract) continue;
            if (compoundJsxNames.has(controller.jsxName)) continue;

            const doc =
                formatJsDoc(controller.doc, controller.namespace) ??
                `A ${controller.namespace}.${controller.className} event controller element.`;

            file.add(
                variableStatement(controller.jsxName, {
                    exported: true,
                    kind: "const",
                    initializer: `"${controller.jsxName}" as const`,
                    doc,
                }),
            );
        }
    }

    buildLayoutManagerExports(
        file: FileBuilder,
        layoutManagers: CodegenLayoutManagerMeta[],
        compoundJsxNames: ReadonlySet<string> = new Set(),
    ): void {
        for (const layoutManager of layoutManagers) {
            if (layoutManager.className === "LayoutManager" || layoutManager.abstract) continue;
            if (IntrinsicElementsBuilder.EXCLUDED_LAYOUT_MANAGER_NAMES.has(layoutManager.jsxName)) continue;
            if (compoundJsxNames.has(layoutManager.jsxName)) continue;

            const doc =
                formatJsDoc(layoutManager.doc, layoutManager.namespace) ??
                `A ${layoutManager.namespace}.${layoutManager.className} layout manager element.`;

            file.add(
                variableStatement(layoutManager.jsxName, {
                    exported: true,
                    kind: "const",
                    initializer: `"${layoutManager.jsxName}" as const`,
                    doc,
                }),
            );
        }
    }

    buildJsxNamespace(
        file: FileBuilder,
        widgets: JsxWidget[],
        controllers: CodegenControllerMeta[],
        layoutManagers: CodegenLayoutManagerMeta[],
    ): void {
        const widgetProperties = widgets
            .filter((w) => w.className !== "Widget")
            .map((w) => `${w.jsxName}: ${w.jsxName}Props;`);

        const controllerProperties = controllers
            .filter((c) => c.className !== "EventController" && !c.abstract)
            .map((c) => `${c.jsxName}: ${c.jsxName}Props;`);

        const layoutManagerProperties = layoutManagers
            .filter(
                (l) =>
                    l.className !== "LayoutManager" &&
                    !l.abstract &&
                    !IntrinsicElementsBuilder.EXCLUDED_LAYOUT_MANAGER_NAMES.has(l.jsxName),
            )
            .map((l) => `${l.jsxName}: ${l.jsxName}Props;`);

        const allProperties = [...widgetProperties, ...controllerProperties, ...layoutManagerProperties];
        const propsBlock = allProperties.map((p) => `        ${p}`).join("\n");

        file.add(
            raw(
                `declare global {\n` +
                    `    namespace React {\n` +
                    `        namespace JSX {\n` +
                    `            interface IntrinsicElements {\n` +
                    `${propsBlock}\n` +
                    `            }\n` +
                    `        }\n` +
                    `    }\n` +
                    `}\n`,
            ),
        );
    }

    buildWidgetSlotNamesType(file: FileBuilder, widgets: JsxWidget[]): void {
        const properties: string[] = [];

        for (const widget of widgets) {
            const slotNames = widget.slots.map((slot) => toCamelCase(slot));

            if (slotNames.length > 0) {
                const unionType = slotNames.map((name) => `"${name}"`).join(" | ");
                properties.push(`${widget.jsxName}: ${unionType}`);
            }
        }

        if (properties.length === 0) {
            file.add(
                typeAlias("WidgetSlotNames", "Record<string, never>", {
                    exported: true,
                    doc: "Type mapping widgets to their valid slot names.",
                }),
            );
        } else {
            file.add(
                typeAlias("WidgetSlotNames", `{ ${properties.join("; ")} }`, {
                    exported: true,
                    doc: "Type mapping widgets to their valid slot names. Used for type-safe Slot components.\nDerived from CodegenWidgetMeta (single source of truth).",
                }),
            );
        }
    }

    addModuleExport(file: FileBuilder): void {
        file.add(raw("export {};\n"));
    }
}
