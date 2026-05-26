/**
 * React Generator
 *
 * Generates React/JSX bindings from widget metadata.
 *
 * Creates JSX intrinsic elements, internal implementations, and
 * compound components for `@gtkx/react`.
 */

import { fileBuilder, stringify } from "../builders/index.js";
import type { CodegenControllerMeta, CodegenWidgetMeta } from "../codegen-metadata.js";
import { RenderableSlotsRegistry } from "../config/index.js";
import type { GeneratedFile } from "../generated-file-set.js";
import { CompoundsGenerator } from "./generators/compounds-generator.js";
import { InternalGenerator } from "./generators/internal.js";
import { JsxTypesGenerator } from "./generators/jsx-types/index.js";
import { MetadataReader } from "./metadata-reader.js";

export class ReactGenerator {
    private readonly reader: MetadataReader;
    private readonly renderableSlots: RenderableSlotsRegistry;

    constructor(
        widgetMeta: readonly CodegenWidgetMeta[],
        private readonly controllers: readonly CodegenControllerMeta[],
        private readonly namespaceNames: string[],
        renderableSlots: RenderableSlotsRegistry = new RenderableSlotsRegistry(),
    ) {
        this.reader = new MetadataReader(widgetMeta);
        this.renderableSlots = renderableSlots;
    }

    generate(): GeneratedFile[] {
        const files: GeneratedFile[] = [];

        const internalFile = fileBuilder();
        const internalGenerator = new InternalGenerator(this.reader, this.controllers);
        internalGenerator.generate(internalFile);
        files.push({ path: "internal.ts", content: stringify(internalFile) });

        const compoundsGenerator = new CompoundsGenerator(
            this.reader,
            this.controllers,
            this.namespaceNames,
            this.renderableSlots,
        );

        const jsxFile = fileBuilder();
        const jsxTypesGenerator = new JsxTypesGenerator(this.reader, this.controllers, this.namespaceNames, {
            compoundJsxNames: compoundsGenerator.getCompoundJsxNames(),
            renderableSlots: this.renderableSlots,
        });
        jsxTypesGenerator.generate(jsxFile);
        files.push({ path: "jsx.ts", content: stringify(jsxFile) });

        const compoundsFile = fileBuilder();
        compoundsGenerator.generate(compoundsFile);
        files.push({ path: "compounds.ts", content: stringify(compoundsFile) });

        return files;
    }
}
