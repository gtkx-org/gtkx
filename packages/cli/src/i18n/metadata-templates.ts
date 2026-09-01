import { toPosixPath } from "@gtkx/utils";
import { join, relative } from "node:path";
import type { CatalogProject } from "./catalogs.js";

type MetadataTemplateKind = "desktop" | "metainfo.xml" | "mime.xml";

type MetadataTemplateFile = {
    kind: MetadataTemplateKind;
    path: string;
    relativePath: string;
};

const METADATA_TEMPLATE_KINDS: MetadataTemplateKind[] = ["desktop", "metainfo.xml", "mime.xml"];
const METADATA_TEMPLATE_DIRNAME = ".gtkx-metadata";

const metadataTemplateFile = (project: CatalogProject, kind: MetadataTemplateKind): MetadataTemplateFile => {
    const path = join(project.poDir, METADATA_TEMPLATE_DIRNAME, `${project.domain}.template.${kind}`);
    const relativePath = toPosixPath(relative(project.root, path));

    return { kind, path, relativePath };
};

const metadataTemplateFiles = (project: CatalogProject): MetadataTemplateFile[] =>
    METADATA_TEMPLATE_KINDS.map((kind) => metadataTemplateFile(project, kind));

export {
    type MetadataTemplateKind,
    metadataTemplateFile,
    metadataTemplateFiles,
};
