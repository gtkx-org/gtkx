import type { CodegenWidgetMeta } from "../core/codegen-metadata.js";
import type { CodegenProject } from "../core/project.js";
import { InternalGenerator } from "./generators/internal.js";
import { JsxTypesGenerator } from "./generators/jsx-types/index.js";
import { RegistryGenerator } from "./generators/registry.js";
import { MetadataReader } from "./metadata-reader.js";

/**
 * Generates React/JSX bindings from widget metadata.
 *
 * Creates JSX intrinsic elements, internal implementations, and
 * component registry for `@gtkx/react`.
 */
export class ReactGenerator {
    private readonly reader: MetadataReader;

    constructor(
        widgetMeta: readonly CodegenWidgetMeta[],
        private readonly project: CodegenProject,
        private readonly namespaceNames: string[],
    ) {
        this.reader = new MetadataReader(widgetMeta);
    }

    generate(): void {
        const internalGenerator = new InternalGenerator(this.reader, this.project);
        internalGenerator.generate();

        const jsxTypesGenerator = new JsxTypesGenerator(this.reader, this.project, this.namespaceNames);
        jsxTypesGenerator.generate();

        const registryGenerator = new RegistryGenerator(this.project, this.namespaceNames);
        registryGenerator.generate();
    }
}
