import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import type { CatalogProject } from "../../i18n/catalogs.js";
import type { StagedMetadata } from "../payload/stage.js";
import { metadataTemplateFile, type MetadataTemplateKind } from "../../i18n/metadata-templates.js";
import { runCliTool } from "../../internal/run-cli-tool.js";

type MergeMode = "--desktop" | "--xml";

type MergeRequest = {
    mode: MergeMode;
    stem: string;
    extension: string;
    template: string;
};

type MetadataTemplate = {
    contents: string;
    path: string;
    relativePath: string;
};

const metadataTemplates = (project: CatalogProject, metadata: StagedMetadata): MetadataTemplate[] => {
    const template = (kind: MetadataTemplateKind, contents: string): MetadataTemplate => {
        const { path, relativePath } = metadataTemplateFile(project, kind);

        return { contents, path, relativePath };
    };

    return [
        template("desktop", metadata.desktopEntry),
        template("metainfo.xml", metadata.metainfo),
        ...(metadata.mimePackage === null ? [] : [template("mime.xml", metadata.mimePackage)]),
    ];
};

const mergeCatalogs = (project: CatalogProject, workDir: string, request: MergeRequest): string => {
    const { extension, mode, stem, template } = request;
    let current = join(workDir, `${stem}-source${extension}`);
    writeFileSync(current, template);

    for (const [index, catalog] of project.catalogs.entries()) {
        const output = join(workDir, `${stem}-${String(index)}${extension}`);

        runCliTool({
            tool: "msgfmt",
            args: [
                mode,
                `--template=${current}`,
                `--locale=${catalog.locale}`,
                `--output-file=${output}`,
                catalog.path,
            ],
            target: catalog.path,
        });

        current = output;
    }

    return readFileSync(current, "utf8");
};

const localizeMetadata = (metadata: StagedMetadata, project: CatalogProject | null): StagedMetadata => {
    if (project === null || project.catalogs.length === 0) {
        return metadata;
    }

    const workDir = mkdtempSync(join(tmpdir(), "gtkx-deploy-metadata-"));

    try {
        return {
            desktopEntry: mergeCatalogs(project, workDir, {
                mode: "--desktop",
                stem: "application",
                extension: ".desktop",
                template: metadata.desktopEntry,
            }),
            metainfo: mergeCatalogs(project, workDir, {
                mode: "--xml",
                stem: "metainfo",
                extension: ".metainfo.xml",
                template: metadata.metainfo,
            }),
            mimePackage: metadata.mimePackage === null
                ? null
                : mergeCatalogs(project, workDir, {
                        mode: "--xml",
                        stem: "mime",
                        extension: ".xml",
                        template: metadata.mimePackage,
                    }),
        };
    } finally {
        rmSync(workDir, { recursive: true, force: true });
    }
};

const extractMetadataMessages = (
    metadata: StagedMetadata,
    project: CatalogProject,
    catalogTemplate?: string,
): void => {
    const potPath = catalogTemplate ?? join(project.poDir, `${project.domain}.pot`);

    if (!existsSync(potPath)) {
        throw new Error(`Cannot add the generated metadata to the missing catalog template: ${potPath}`);
    }

    const templates = metadataTemplates(project, metadata);
    const firstTemplate = templates[0];

    if (firstTemplate === undefined) {
        throw new Error("Cannot extract metadata messages without a generated template");
    }

    const metadataDir = dirname(firstTemplate.path);
    mkdirSync(metadataDir, { recursive: true });

    try {
        for (const template of templates) {
            writeFileSync(template.path, template.contents);
        }

        runCliTool({
            tool: "xgettext",
            args: [
                "--join-existing",
                "--force-po",
                "--from-code=UTF-8",
                `--output=${potPath}`,
                ...templates.map((template) => template.relativePath),
            ],
            target: potPath,
            options: { cwd: project.root },
        });
    } finally {
        for (const template of templates) {
            rmSync(template.path, { force: true });
        }
    }
};

export { extractMetadataMessages, localizeMetadata };
