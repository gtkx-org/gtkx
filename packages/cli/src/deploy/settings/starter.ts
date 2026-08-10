import type { PackageManifest } from "./package-manifest.js";

const INDENT = " ".repeat(4);
const DOCS_URL = "https://gtkx.dev/guide/deploying";

const quoted = (value: string): string => JSON.stringify(value);

const titleFor = (applicationId: string): string => {
    const segment = applicationId.split(".").at(-1) ?? applicationId;

    return segment.charAt(0).toUpperCase() + segment.slice(1);
};

const developerLine = (manifest: PackageManifest): string => {
    const name = manifest.author.name ?? "Your Name";
    const email = manifest.author.email;
    const parts = email === null ? [`name: ${quoted(name)}`] : [`name: ${quoted(name)}`, `email: ${quoted(email)}`];

    return `${INDENT.repeat(2)}developer: { ${parts.join(", ")} },`;
};

const starterBlock = (applicationId: string, manifest: PackageManifest): string =>
    [
        `${INDENT}deploy: {`,
        `${INDENT.repeat(2)}name: ${quoted(manifest.name ?? titleFor(applicationId))},`,
        `${INDENT.repeat(2)}summary: ${quoted(manifest.description ?? "What the app does, in one line")},`,
        `${INDENT.repeat(2)}categories: ["Utility"],`,
        developerLine(manifest),
        `${INDENT.repeat(2)}license: ${quoted(manifest.license ?? "MIT")},`,
        `${INDENT}},`,
    ].join("\n");

const missingDeployError = (applicationId: string, manifest: PackageManifest): Error =>
    new Error(
        "gtkx.config.ts: no `deploy` section, so there is nothing to package.\n" +
        "Add this to gtkx.config.ts and adjust it:\n\n" +
        `${starterBlock(applicationId, manifest)}\n\n` +
        `Every value above was derived from package.json; see ${DOCS_URL}.`,
    );

export { missingDeployError };
