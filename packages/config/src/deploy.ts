import { z } from "zod";
import {
    fileExtension,
    flag,
    girLibrary,
    relativePathRecord,
    text,
    textList,
    textRecord,
    url,
} from "./schema-text.ts";

const APPIMAGE_COMPRESSIONS = ["gzip", "xz", "zstd"] as const;
const DEB_COMPRESSIONS = ["gzip", "none", "xz", "zstd"] as const;
const DEB_SIGN_METHODS = ["debsign", "dpkg-sig"] as const;
const DEB_SIGN_TYPES = ["archive", "maint", "origin"] as const;
const DEPLOY_TARGET_NAMES = ["appimage", "deb", "flatpak", "rpm"] as const;
const FLATPAK_MODES = ["prebuilt", "source"] as const;
const NODE_SOURCES = ["download", "host", "path"] as const;
const OARS_INTENSITIES = ["intense", "mild", "moderate", "none"] as const;
const PACKAGE_MANAGERS = ["npm", "pnpm", "yarn"] as const;
const RELEASE_TYPES = ["development", "snapshot", "stable"] as const;
const RELEASE_URGENCIES = ["critical", "high", "low", "medium"] as const;
const RPM_COMPRESSIONS = ["gzip", "lzma", "xz", "zstd"] as const;

const URL_KINDS = [
    "bugtracker",
    "contact",
    "contribute",
    "donation",
    "faq",
    "help",
    "translate",
    "vcs-browser",
] as const;

const BOOLEAN_ERROR = "must be a boolean";
const EPOCH_ERROR = "must be a non-negative integer";
const EXTRA_FILE_ERROR = "must be a source path or a { source, mode } entry";
const FILE_MODE_ERROR = "must be an octal file mode without setuid or setgid bits, such as 755";
const FILE_MODE_PATTERN = /^[0-7]{3,4}$/;
const FILE_MODE_RADIX = 8;
const PRIVILEGED_FILE_MODE_MASK = 0o6000;
const HEX_COLOR_ERROR = "must be a #rrggbb color";
const HEX_COLOR_PATTERN = /^#[\dA-Fa-f]{6}$/;
const KEY_FILE_ERROR = "must be a path to a PGP key file";
const KEY_ID_ERROR = "must be a PGP key id";
const LAUNCHER_ENV_ERROR = "must be a record of POSIX environment names to values without null bytes";
const LAUNCHER_ENV_NAME_ERROR = "must be a POSIX environment name";
const LAUNCHER_ENV_NAME_PATTERN = /^[A-Za-z_]\w*$/;
const MINIMUM_LIBRARY_VERSION_ERROR = "must be a version such as 4.18";
const MINIMUM_LIBRARY_VERSION_PATTERN = /^\d+(?:\.\d+)*$/;
const MINIMUM_LIBRARY_VERSIONS_ERROR = "must be a record of GIR library ids to a minimum version";
const NODE_FLAG_ERROR = "must be a Node.js flag beginning with a hyphen and containing no null bytes";
const LIBRARY_ID_ERROR = 'must be a GIR library identifier of the form "Name-Version", such as "Gtk-4.0"';
const SCRIPT_ERROR = "must be a path to a shell script";
const SOURCE_PATH_ERROR = "must be a source path";
const SPDX_ERROR = "must be an SPDX license expression";
const URL_ERROR = "must be an absolute URL";
const VERSION_ERROR = "must be a version string";
const hexColorSchema = z.string({ error: HEX_COLOR_ERROR }).regex(HEX_COLOR_PATTERN, { error: HEX_COLOR_ERROR });

const minimumLibraryVersionSchema = z
    .string({ error: MINIMUM_LIBRARY_VERSION_ERROR })
    .regex(MINIMUM_LIBRARY_VERSION_PATTERN, { error: MINIMUM_LIBRARY_VERSION_ERROR });

const minimumLibraryVersionsSchema = z.record(girLibrary(LIBRARY_ID_ERROR), minimumLibraryVersionSchema, {
    error: MINIMUM_LIBRARY_VERSIONS_ERROR,
});

const relationsSchema = z.strictObject({
    deb: textList("Debian package relation", "must be an array of Debian package relations").optional(),
    rpm: textList("RPM package relation", "must be an array of RPM package relations").optional(),
});

const developerSchema = z.strictObject({
    id: text("must be a reverse-DNS developer id").optional(),
    name: text("must be a developer or organization name").optional(),
    email: text("must be an email address").optional(),
});

const screenshotSchema = z
    .strictObject({
        url: url("must be an absolute URL to a PNG or JPEG").optional(),
        file: text("must be an image path relative to the project root").optional(),
        caption: text("must be a screenshot caption").optional(),
        isDefault: flag(BOOLEAN_ERROR).optional(),
    })
    .refine((entry) => entry.url !== undefined || entry.file !== undefined, {
        error: "must have either a `url` or a `file`",
    });

const releaseSchema = z.strictObject({
    version: text(VERSION_ERROR),
    date: z.iso.date({ error: "must be an ISO date (YYYY-MM-DD)" }),
    type: z.enum(RELEASE_TYPES, { error: "must be one of development, snapshot, stable" }).optional(),
    urgency: z.enum(RELEASE_URGENCIES, { error: "must be one of critical, high, low, medium" }).optional(),
    notes: textList("release note paragraph", "must be an array of release note paragraphs").optional(),
    url: url(URL_ERROR).optional(),
});

const fileAssociationSchema = z.strictObject({
    extension: fileExtension("must be a file extension without a leading dot"),
    mimeType: text("must be a MIME type such as text/plain"),
    description: text("must be a description of the file type").optional(),
});

const desktopActionSchema = z.strictObject({
    name: text("must be an action name"),
    args: textList("argument", "must be an array of arguments appended to Exec").optional(),
    icon: text("must be an icon name").optional(),
});

const brandingSchema = z.strictObject({
    light: hexColorSchema,
    dark: hexColorSchema,
});

const extraFileSchema = z.strictObject({
    source: text(SOURCE_PATH_ERROR),
    mode: z
        .string({ error: FILE_MODE_ERROR })
        .regex(FILE_MODE_PATTERN, { error: FILE_MODE_ERROR })
        .refine((mode) => (Number.parseInt(mode, FILE_MODE_RADIX) & PRIVILEGED_FILE_MODE_MASK) === 0, {
            error: FILE_MODE_ERROR,
        })
        .optional(),
});

const extraFileEntrySchema = z.union([text(SOURCE_PATH_ERROR), extraFileSchema], { error: EXTRA_FILE_ERROR });

const launcherEnvSchema = z.record(
    z.string({ error: LAUNCHER_ENV_NAME_ERROR }).regex(LAUNCHER_ENV_NAME_PATTERN, { error: LAUNCHER_ENV_NAME_ERROR }),
    z.string({ error: LAUNCHER_ENV_ERROR }).refine((value) => !value.includes("\0"), { error: LAUNCHER_ENV_ERROR }),
    { error: (issue) => issue.code === "invalid_key" ? LAUNCHER_ENV_NAME_ERROR : LAUNCHER_ENV_ERROR },
);

const nodeFlagsSchema = z.array(
    z
        .string({ error: NODE_FLAG_ERROR })
        .refine((value) => value.startsWith("-") && !value.includes("\0"), { error: NODE_FLAG_ERROR }),
    { error: "must be an array of Node.js flags" },
);

const nodeRuntimeSchema = z.strictObject({
    source: z.enum(NODE_SOURCES, { error: "must be one of download, host, path" }).optional(),
    version: text("must be a Node.js version such as 26.7.0").optional(),
    path: text("must be a path to a node binary").optional(),
    shouldStrip: flag(BOOLEAN_ERROR).optional(),
    shouldUseCompileCache: flag(BOOLEAN_ERROR).optional(),
});

const scriptsSchema = z.strictObject({
    preInstall: text(SCRIPT_ERROR).optional(),
    postInstall: text(SCRIPT_ERROR).optional(),
    preRemove: text(SCRIPT_ERROR).optional(),
    postRemove: text(SCRIPT_ERROR).optional(),
});

const debSchema = z.strictObject({
    packageName: text("must be a Debian package name").optional(),
    section: text("must be a Debian archive section").optional(),
    priority: text("must be a Debian priority").optional(),
    compression: z.enum(DEB_COMPRESSIONS, { error: "must be one of gzip, none, xz, zstd" }).optional(),
    fields: textRecord("must be a control field value", "must be a record of control field names to values")
        .optional(),
});

const rpmSchema = z.strictObject({
    packageName: text("must be an RPM package name").optional(),
    group: text("must be an RPM group").optional(),
    compression: z.enum(RPM_COMPRESSIONS, { error: "must be one of gzip, lzma, xz, zstd" }).optional(),
    prefixes: textList("prefix", "must be an array of relocation prefixes").optional(),
});

const appimageSchema = z.strictObject({
    fileName: text("must be an output file name").optional(),
    compression: z.enum(APPIMAGE_COMPRESSIONS, { error: "must be one of gzip, xz, zstd" }).optional(),
    updateInformation: text("must be an AppImage update information string").optional(),
    runtimeFile: text("must be a path to an AppImage runtime file").optional(),
});

const flatpakSourceSchema = z.strictObject({
    url: url("must be an absolute git URL").optional(),
    tag: text("must be a git tag").optional(),
    commit: text("must be a git commit sha").optional(),
});

const flatpakSchema = z.strictObject({
    mode: z.enum(FLATPAK_MODES, { error: 'must be "prebuilt" or "source"' }).optional(),
    runtime: text("must be a runtime id").optional(),
    runtimeVersion: text('must be a runtime branch such as "50"').optional(),
    sdk: text("must be an SDK id").optional(),
    nodeExtension: text("must be a Node SDK extension id").optional(),
    sdkExtensions: textList("SDK extension id", "must be an array of SDK extension ids").optional(),
    base: text("must be a base app id").optional(),
    baseVersion: text("must be a base app version").optional(),
    branch: text("must be a branch name").optional(),
    finishArgs: textList("finish argument", "must be an array of flatpak finish arguments").optional(),
    cleanup: textList("cleanup pattern", "must be an array of cleanup patterns").optional(),
    buildCommands: textList("shell command", "must be an array of shell commands").optional(),
    modules: z.array(z.unknown(), { error: "must be an array of flatpak module objects" }).optional(),
    source: flatpakSourceSchema.optional(),
    packageManager: z.enum(PACKAGE_MANAGERS, { error: "must be one of npm, pnpm, yarn" }).optional(),
    lockfile: text("must be a path to a lockfile").optional(),
    runtimeRepo: url("must be an absolute .flatpakrepo URL").optional(),
    shouldEmitBundle: flag(BOOLEAN_ERROR).optional(),
    shouldInstall: flag(BOOLEAN_ERROR).optional(),
    shouldUseRofilesFuse: flag(BOOLEAN_ERROR).optional(),
});

const debSigningSchema = z.strictObject({
    keyFile: text(KEY_FILE_ERROR),
    keyId: text(KEY_ID_ERROR).optional(),
    method: z.enum(DEB_SIGN_METHODS, { error: 'must be "debsign" or "dpkg-sig"' }).optional(),
    type: z.enum(DEB_SIGN_TYPES, { error: "must be one of archive, maint, origin" }).optional(),
    signer: text("must be a signer name and email").optional(),
});

const rpmSigningSchema = z.strictObject({
    keyFile: text(KEY_FILE_ERROR),
    keyId: text(KEY_ID_ERROR).optional(),
});

const flatpakSigningSchema = z.strictObject({
    gpgKeyId: text("must be a GPG key id"),
    gpgHomeDir: text("must be a path to a GPG home directory").optional(),
});

const appimageSigningSchema = z.strictObject({
    gpgKeyId: text("must be a GPG key id"),
});

const signingSchema = z.strictObject({
    appimage: appimageSigningSchema.optional(),
    deb: debSigningSchema.optional(),
    flatpak: flatpakSigningSchema.optional(),
    rpm: rpmSigningSchema.optional(),
});

const extraRelationsSchema = z.strictObject({
    recommends: relationsSchema.optional(),
    suggests: relationsSchema.optional(),
    provides: relationsSchema.optional(),
    conflicts: relationsSchema.optional(),
    replaces: relationsSchema.optional(),
    breaks: relationsSchema.optional(),
    preDepends: relationsSchema.optional(),
});

const deploySchema = z.strictObject({
    targets: z
        .array(z.enum(DEPLOY_TARGET_NAMES, { error: "must be one of appimage, deb, flatpak, rpm" }), {
            error: "must be an array of deploy targets",
        })
        .optional(),
    outDir: text("must be a directory path relative to the project root").optional(),
    name: text("must be the display name shown in the launcher").optional(),
    genericName: text("must be a generic application name").optional(),
    binaryName: text("must be a kebab-case command name").optional(),
    version: text(VERSION_ERROR).optional(),
    release: text("must be a packaging revision").optional(),
    epoch: z.int({ error: EPOCH_ERROR }).min(0, { error: EPOCH_ERROR }).optional(),
    summary: text("must be a single-line summary without a trailing period").optional(),
    description: textList("description paragraph", "must be an array of description paragraphs").optional(),
    keywords: textList("search keyword", "must be an array of search keywords").optional(),
    categories: textList("freedesktop category", "must be an array of freedesktop categories").optional(),
    mimeTypes: textList("MIME type", "must be an array of MIME types").optional(),
    developer: developerSchema.optional(),
    license: text(SPDX_ERROR).optional(),
    licenseFile: text("must be a path to a license file").optional(),
    metadataLicense: text(SPDX_ERROR).optional(),
    copyright: text("must be a copyright line").optional(),
    homepage: url(URL_ERROR).optional(),
    urls: z
        .partialRecord(z.enum(URL_KINDS), url(URL_ERROR), {
            error: "must be a record of AppStream url kinds to URLs",
        })
        .optional(),
    screenshots: z.array(screenshotSchema, { error: "must be an array of screenshots" }).optional(),
    screenshotBaseUrl: url("must be an absolute base URL").optional(),
    branding: brandingSchema.optional(),
    contentRating: z
        .record(z.string(), z.enum(OARS_INTENSITIES, { error: "must be one of intense, mild, moderate, none" }), {
            error: "must be a record of OARS 1.1 attribute ids to intensities",
        })
        .optional(),
    releases: z.array(releaseSchema, { error: "must be an array of releases" }).optional(),
    execArgs: textList("argument", "must be an array of arguments appended to Exec").optional(),
    launcherEnv: launcherEnvSchema.optional(),
    nodeFlags: nodeFlagsSchema.optional(),
    fileAssociations: z
        .array(fileAssociationSchema, { error: "must be an array of file associations" })
        .optional(),
    protocols: textList("URL scheme", "must be an array of URL schemes").optional(),
    desktopActions: z
        .record(z.string(), desktopActionSchema, { error: "must be a record of action ids to actions" })
        .optional(),
    desktopEntry: textRecord("must be a desktop entry value", "must be a record of desktop entry keys to values")
        .optional(),
    metainfoExtra: textList("AppStream XML fragment", "must be an array of AppStream XML fragments").optional(),
    isDbusActivatable: flag(BOOLEAN_ERROR).optional(),
    extraFiles: relativePathRecord(
        "must be a destination path inside the install prefix, without a leading slash or a .. segment",
        extraFileEntrySchema,
        "must be a record of prefix-relative destinations to source paths or { source, mode } entries",
    ).optional(),
    minimumLibraryVersions: minimumLibraryVersionsSchema.optional(),
    depends: relationsSchema.optional(),
    relations: extraRelationsSchema.optional(),
    scripts: scriptsSchema.optional(),
    node: nodeRuntimeSchema.optional(),
    signing: signingSchema.optional(),
    appimage: appimageSchema.optional(),
    deb: debSchema.optional(),
    flatpak: flatpakSchema.optional(),
    rpm: rpmSchema.optional(),
});

export { deploySchema };
