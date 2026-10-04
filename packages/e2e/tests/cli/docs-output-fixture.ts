import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect } from "vitest";
import {
    type CliProject,
    createCliProject,
    type DisposableCliProject,
    runCliOrThrow,
} from "./cli-project.js";

const REFERENCE_OUTPUT = "docs/reference";
const REFERENCE_CONFIG = 'export default { applicationId: "org.gtkx.referenceoutput",' +
    " agents: { reference: true, rules: false } };";

type ReferenceManifest = {
    namespaces: { name: string; link: string; elements: { text: string; link: string }[] }[];
};

const createReferenceOutputProject = (prefix: string): DisposableCliProject =>
    createCliProject({ prefix, config: REFERENCE_CONFIG });

const readReferencePage = (project: CliProject, path: string): string =>
    readFileSync(join(project.root, REFERENCE_OUTPUT, path), "utf8");

const expectReferenceLinks = ({ basePath, expected }: { basePath: string; expected: string }): void => {
    using project = createReferenceOutputProject("gtkx-reference-links-");
    runCliOrThrow(project, ["docs", "--out", REFERENCE_OUTPUT, "--base-path", basePath]);
    const manifest = JSON.parse(readReferencePage(project, "manifest.json")) as ReferenceManifest;
    const gtk = manifest.namespaces.find((namespace) => namespace.name === "Gtk");
    expect(gtk?.link).toBe(`${expected}/gtk/`);
    expect(gtk?.elements).toContainEqual({ text: "GtkButton", link: `${expected}/gtk/button` });
    expect(readReferencePage(project, "gtk/index.md")).toContain(`[GtkButton](${expected}/gtk/button)`);
    expect(readReferencePage(project, "gtk/button.md")).toContain(`[GtkWidget](${expected}/gtk/widget)`);
};

export {
    createReferenceOutputProject,
    expectReferenceLinks,
    readReferencePage,
    REFERENCE_OUTPUT,
};
