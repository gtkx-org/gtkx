import { readFileSync, writeFileSync } from "node:fs";
import { relative } from "node:path";
import { satisfies, valid, validRange } from "semver";
import { isMap, isScalar, parseDocument, type Document } from "yaml";
import { z } from "zod";
import { type DependencyField, isGtkxPackage, manifestPath, parseManifest, readManifest } from "./manifest.js";
import type { Workspace } from "./workspace.js";

type SpecChange = { file: string; location: string; name: string; from: string; to: string };
type KeptSpec = { file: string; name: string; spec: string };

type UpgradePlan = {
    changes: SpecChange[];
    kept: KeptSpec[];
    write: () => void;
};

const UPGRADED_FIELDS: readonly DependencyField[] = [
    "dependencies",
    "devDependencies",
    "optionalDependencies",
    "peerDependencies",
];
const PEER_FIELD: DependencyField = "peerDependencies";
const VERSION_SPEC = /^(?<operator>\^|~|>=|=)?(?<version>\d\S*)$/;
const CATALOG_PROTOCOL = "catalog:";
const DEFAULT_INDENT = "  ";
const CatalogsSchema = z.looseObject({ catalogs: z.record(z.string(), z.unknown()).optional() }).nullable();

/**
 * The spec that pins `version` with the range operator of `spec`, or null for specs that do not name a
 * registry version, such as `workspace:`, `catalog:`, `file:` or a dist-tag.
 */
const upgradedSpec = (spec: string, version: string): string | null => {
    const groups = VERSION_SPEC.exec(spec)?.groups;

    if (groups?.version === undefined || valid(groups.version) === null) {
        return null;
    }

    return `${groups.operator ?? ""}${version}`;
};

const acceptsVersion = (range: string, version: string): boolean =>
    satisfies(version, range, { includePrerelease: true });

/**
 * The spec `planManifest` writes for `spec` in `field`: peer ranges that already accept `version` stay as
 * they are, so a deliberately wide range is never narrowed.
 */
const targetSpec = (field: DependencyField, spec: string, version: string): string | null =>
    field === PEER_FIELD && acceptsVersion(spec, version) ? null : upgradedSpec(spec, version);

const indentOf = (text: string): string => /^(?<indent>[ \t]+)"/m.exec(text)?.groups?.indent ?? DEFAULT_INDENT;

const planManifest = (directory: string, version: string): UpgradePlan => {
    const file = manifestPath(directory);
    const text = readFileSync(file, "utf8");
    const document = z.record(z.string(), z.unknown()).parse(JSON.parse(text));
    const manifest = parseManifest(document);
    const changes: SpecChange[] = [];
    const kept: KeptSpec[] = [];

    for (const field of UPGRADED_FIELDS) {
        const specs = manifest[field] ?? {};

        for (const [name, spec] of Object.entries(specs).filter(([name]) => isGtkxPackage(name))) {
            const to = targetSpec(field, spec, version);

            if (to === null) {
                if (!spec.startsWith(CATALOG_PROTOCOL)) {
                    kept.push({ file, name, spec });
                }
            } else if (to !== spec) {
                specs[name] = to;
                document[field] = specs;
                changes.push({ file, location: field, name, from: spec, to });
            }
        }
    }

    return {
        changes,
        kept,
        write: () => {
            writeFileSync(file, `${JSON.stringify(document, null, indentOf(text))}${text.endsWith("\n") ? "\n" : ""}`);
        },
    };
};

const catalogPaths = (document: Document): string[][] => {
    const names = Object.keys(CatalogsSchema.parse(document.toJS())?.catalogs ?? {});

    return [["catalog"], ...names.map((name) => ["catalogs", name])];
};

const planCatalogs = (file: string, version: string): UpgradePlan => {
    const document = parseDocument(readFileSync(file, "utf8"));
    const changes: SpecChange[] = [];

    for (const path of catalogPaths(document)) {
        const catalog = document.getIn(path);

        if (!isMap(catalog)) {
            continue;
        }

        for (const item of catalog.items) {
            if (!isScalar(item.key) || !isScalar(item.value)) {
                continue;
            }

            const name = String(item.key.value);
            const spec = item.value.value;

            if (!isGtkxPackage(name) || typeof spec !== "string") {
                continue;
            }

            const to = upgradedSpec(spec, version);

            if (to !== null && to !== spec) {
                item.value.value = to;
                changes.push({ file, location: path.join("."), name, from: spec, to });
            }
        }
    }

    return {
        changes,
        kept: [],
        write: () => {
            writeFileSync(file, document.toString());
        },
    };
};

/**
 * Rewrites every GTKX spec of the workspace's manifests and pnpm catalogs to `version`, keeping each spec's
 * range operator. Peer ranges move only when they do not accept `version`. Nothing is written until `write`
 * runs.
 */
const planUpgrade = (workspace: Workspace, version: string): UpgradePlan => {
    const plans = [
        ...workspace.members.map((member) => planManifest(member, version)),
        ...(workspace.catalogFile === null ? [] : [planCatalogs(workspace.catalogFile, version)]),
    ];
    const changed = plans.filter((plan) => plan.changes.length > 0);

    return {
        changes: plans.flatMap((plan) => plan.changes),
        kept: plans.flatMap((plan) => plan.kept),
        write: () => {
            for (const plan of changed) {
                plan.write();
            }
        },
    };
};

/**
 * Lists the GTKX peer dependency ranges of the workspace's manifests that do not accept `version`, such as a
 * range combining several versions that `planUpgrade` cannot move.
 */
const excludingPeerRanges = (workspace: Workspace, version: string): string[] =>
    workspace.members.flatMap((member) =>
        Object.entries(readManifest(member).peerDependencies ?? {})
            .filter(([name, range]) => isGtkxPackage(name) && validRange(range) !== null)
            .filter(([, range]) => !acceptsVersion(range, version))
            .map(([name, range]) => `${relative(workspace.root, manifestPath(member))} ${name} ${range}`),
    );

export { excludingPeerRanges, planUpgrade, type UpgradePlan };
