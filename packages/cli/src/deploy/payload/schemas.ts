import { basename, join } from "node:path";
import type { DeploySettings, StagedFile } from "../types.js";
import { copyInto } from "./copy-tree.js";

const SHARE_SCHEMAS = "share/glib-2.0/schemas";

const assertSchemaName = (settings: DeploySettings, file: string): void => {
    const name = basename(file);

    if (name.startsWith(settings.applicationId)) {
        return;
    }

    throw new Error(
        `Cannot install "${name}": every installed GSettings schema shares one system directory, so its file name ` +
        `has to start with the application id. Rename it to ${settings.applicationId}.gschema.xml.`,
    );
};

const stageSchemas = (settings: DeploySettings, root: string): StagedFile[] =>
    settings.paths.schemaFiles.map((file) => {
        assertSchemaName(settings, file);

        return copyInto(root, join(SHARE_SCHEMAS, basename(file)), file);
    });

export { stageSchemas };
