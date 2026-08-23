import type { DeployPayload, DeploySettings, StagedFile } from "../types.js";
import { resolveDepends } from "../depends.js";
import { groupForCategories, sectionForCategories } from "../settings/categories.js";
import { nfpmContents } from "./contents.js";
import { debDescription, rpmDescription } from "./description.js";
import { type Entries, optional, when } from "./optional.js";

type NfpmPackager = "deb" | "rpm";
type NfpmConfig = Entries;

const PREFIX = "/usr";
const DEFAULT_PRIORITY = "optional";
const DEFAULT_UMASK = 0o022;
const VERSION_SCHEMA = "none";

const maintainerFor = (settings: DeploySettings): string => {
    const { name, email } = settings.developer;

    return email === null ? name : `${name} <${email}>`;
};

const scriptsFor = (settings: DeploySettings): NfpmConfig | undefined => {
    const scripts = settings.deploy.scripts;

    if (scripts === undefined) {
        return undefined;
    }

    return {
        ...optional("preinstall", scripts.preInstall),
        ...optional("postinstall", scripts.postInstall),
        ...optional("preremove", scripts.preRemove),
        ...optional("postremove", scripts.postRemove),
    };
};

const relationsFor = (settings: DeploySettings, packager: NfpmPackager): NfpmConfig => {
    const relations = settings.deploy.relations ?? {};

    return {
        ...optional("recommends", relations.recommends?.[packager]),
        ...optional("suggests", relations.suggests?.[packager]),
        ...optional("provides", relations.provides?.[packager]),
        ...optional("conflicts", relations.conflicts?.[packager]),
        ...optional("replaces", relations.replaces?.[packager]),
    };
};

const debSection = (settings: DeploySettings): NfpmConfig => ({
    section: settings.deploy.deb?.section ?? sectionForCategories(settings.categories),
    priority: settings.deploy.deb?.priority ?? DEFAULT_PRIORITY,
});

const debSignature = (settings: DeploySettings): NfpmConfig => {
    const signing = settings.deploy.signing?.deb;

    if (signing === undefined) {
        return {};
    }

    return {
        signature: {
            key_file: signing.keyFile,
            ...optional("key_id", signing.keyId),
            ...optional("method", signing.method),
            ...optional("type", signing.type),
            ...optional("signer", signing.signer),
        },
    };
};

const rpmSignature = (settings: DeploySettings): NfpmConfig => {
    const signing = settings.deploy.signing?.rpm;

    if (signing === undefined) {
        return {};
    }

    return { signature: { key_file: signing.keyFile, ...optional("key_id", signing.keyId) } };
};

const debSettings = (settings: DeploySettings): NfpmConfig => {
    const deb = settings.deploy.deb ?? {};
    const relations = settings.deploy.relations ?? {};

    return {
        ...optional("compression", deb.compression),
        ...optional("fields", deb.fields),
        ...optional("breaks", relations.breaks?.deb),
        ...optional("predepends", relations.preDepends?.deb),
        ...debSignature(settings),
    };
};

const rpmSettings = (settings: DeploySettings): NfpmConfig => {
    const rpm = settings.deploy.rpm ?? {};

    return {
        group: rpm.group ?? groupForCategories(settings.categories),
        summary: settings.summary,
        packager: maintainerFor(settings),
        ...optional("compression", rpm.compression),
        ...optional("prefixes", rpm.prefixes),
        ...rpmSignature(settings),
    };
};

const packageNameFor = (settings: DeploySettings, packager: NfpmPackager): string =>
    settings.deploy[packager]?.packageName ?? settings.binaryName;

const stagedFilesFor = (payload: DeployPayload, packager: NfpmPackager): StagedFile[] => [
    ...payload.stage,
    ...payload.overlays[packager],
];

const packagerSettings = (settings: DeploySettings, packager: NfpmPackager): NfpmConfig =>
    packager === "rpm" ? rpmSettings(settings) : debSettings(settings);

const releaseFor = (settings: DeploySettings, packager: NfpmPackager): string =>
    packager === "rpm" ? settings.versions.rpmRelease : settings.versions.debRevision;

const descriptionFor = (settings: DeploySettings, packager: NfpmPackager): string =>
    packager === "rpm" ? rpmDescription(settings) : debDescription(settings);

const renderNfpmConfig = (payload: DeployPayload, packager: NfpmPackager): NfpmConfig => {
    const settings = payload.settings;
    const isRpm = packager === "rpm";
    const depends = resolveDepends(settings, payload.node?.glibcMinimum ?? null);

    return {
        name: packageNameFor(settings, packager),
        arch: settings.arch[packager],
        platform: "linux",
        version: settings.versions.packageVersion,
        version_schema: VERSION_SCHEMA,
        release: releaseFor(settings, packager),
        ...optional("epoch", settings.versions.epoch === null ? undefined : String(settings.versions.epoch)),
        ...when(!isRpm, debSection(settings)),
        maintainer: maintainerFor(settings),
        vendor: settings.developer.name,
        ...optional("homepage", settings.homepage),
        license: settings.license,
        description: descriptionFor(settings, packager),
        umask: DEFAULT_UMASK,
        depends: depends[packager],
        ...relationsFor(settings, packager),
        ...optional("scripts", scriptsFor(settings)),
        [packager]: packagerSettings(settings, packager),
        contents: nfpmContents(PREFIX, stagedFilesFor(payload, packager), isRpm),
    };
};

export { type NfpmPackager, packageNameFor, renderNfpmConfig };
