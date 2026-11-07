import { z } from "zod";
import { fileExtension, flag, girLibrary, relativePathRecord, text, textList, textRecord, url } from "./schema-text.ts";

const DEB_COMPRESSIONS = ["gzip", "none", "xz", "zstd"] as const;
const DEB_SIGN_METHODS = ["debsign", "dpkg-sig"] as const;
const DEB_SIGN_TYPES = ["archive", "maint", "origin"] as const;
const DEPLOY_ARCH_NAMES = ["arm64", "x64"] as const;
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
const LIBRARY_ID_ERROR = 'must be a GIR library identifier of the form "Name-Version", such as "Adw-1"';
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

/** Package relations of one kind, such as dependencies, in Debian and RPM dependency syntax. */
type DeployPackageRelationOptions = {
    /** Package relations expressed in Debian dependency syntax. */
    deb?: string[] | undefined;
    /** Package relations expressed in RPM dependency syntax. */
    rpm?: string[] | undefined;
};

const relationsSchema = z.strictObject({
    deb: textList("Debian package relation", "must be an array of Debian package relations").optional(),
    rpm: textList("RPM package relation", "must be an array of RPM package relations").optional(),
}) satisfies z.ZodType<DeployPackageRelationOptions>;

/** Package relations of a kind only Debian packages have, in Debian dependency syntax. */
type DeployDebPackageRelationOptions = {
    /** Package relations expressed in Debian dependency syntax. RPM has no equivalent relation. */
    deb?: string[] | undefined;
};

const debRelationsSchema = z.strictObject({
    deb: textList("Debian package relation", "must be an array of Debian package relations").optional(),
}) satisfies z.ZodType<DeployDebPackageRelationOptions>;

/** The `deploy.developer` options: who develops and maintains the application. */
type DeployDeveloperOptions = {
    /** Reverse-DNS developer identifier, derived from the application ID when omitted. */
    id?: string | undefined;
    /** Developer or organization name. Defaults to the author in package.json. */
    name?: string | undefined;
    /** Maintainer email address. Defaults to the author's email in package.json. */
    email?: string | undefined;
};

const developerSchema = z.strictObject({
    id: text("must be a reverse-DNS developer id").optional(),
    name: text("must be a developer or organization name").optional(),
    email: text("must be an email address").optional(),
}) satisfies z.ZodType<DeployDeveloperOptions>;

/** One software-center screenshot in `deploy.screenshots`. Either `url` or `file` must be set. */
type DeployScreenshotOptions = {
    /** Absolute URL of a PNG or JPEG screenshot. Takes precedence over `file`. */
    url?: string | undefined;
    /** Screenshot path relative to the project root, resolved against `screenshotBaseUrl`. */
    file?: string | undefined;
    /** Caption displayed with the screenshot in software centers. */
    caption?: string | undefined;
    /** Marks the primary screenshot. Only the first entry set to `true` is used. */
    isDefault?: boolean | undefined;
};

const screenshotSchema = z
    .strictObject({
        url: url("must be an absolute URL to a PNG or JPEG").optional(),
        file: text("must be an image path relative to the project root").optional(),
        caption: text("must be a screenshot caption").optional(),
        isDefault: flag(BOOLEAN_ERROR).optional(),
    })
    .refine((entry) => entry.url !== undefined || entry.file !== undefined, {
        error: "must have either a `url` or a `file`",
    }) satisfies z.ZodType<DeployScreenshotOptions>;

/** One AppStream release-history entry in `deploy.releases`. */
type DeployReleaseOptions = {
    /** Application version described by this release. */
    version: string;
    /** Release date in `YYYY-MM-DD` format. */
    date: string;
    /** AppStream release classification. */
    type?: "development" | "snapshot" | "stable" | undefined;
    /** AppStream update urgency. */
    urgency?: "critical" | "high" | "low" | "medium" | undefined;
    /** Release notes, with each entry rendered as a paragraph. */
    notes?: string[] | undefined;
    /** Absolute URL containing further details about the release. */
    url?: string | undefined;
};

const releaseSchema = z.strictObject({
    version: text(VERSION_ERROR),
    date: z.iso.date({ error: "must be an ISO date (YYYY-MM-DD)" }),
    type: z.enum(RELEASE_TYPES, { error: "must be one of development, snapshot, stable" }).optional(),
    urgency: z.enum(RELEASE_URGENCIES, { error: "must be one of critical, high, low, medium" }).optional(),
    notes: textList("release note paragraph", "must be an array of release note paragraphs").optional(),
    url: url(URL_ERROR).optional(),
}) satisfies z.ZodType<DeployReleaseOptions>;

/** One file extension and MIME type registered through `deploy.fileAssociations`. */
type DeployFileAssociationOptions = {
    /** File extension to associate with the application, without a leading dot. */
    extension: string;
    /** MIME type registered for the file extension. */
    mimeType: string;
    /** Human-readable description of the file type. */
    description?: string | undefined;
};

const fileAssociationSchema = z.strictObject({
    extension: fileExtension("must be a file extension without a leading dot"),
    mimeType: text("must be a MIME type such as text/plain"),
    description: text("must be a description of the file type").optional(),
}) satisfies z.ZodType<DeployFileAssociationOptions>;

/** One desktop launcher action in `deploy.desktopActions`, keyed by its action ID. */
type DeployDesktopActionOptions = {
    /** Action label shown in the desktop launcher menu. */
    name: string;
    /**
     * Arguments appended to the launch command when the action is chosen. Launchers activate the `app.<id>`
     * application action of a D-Bus-activatable application instead of running this command.
     */
    args?: string[] | undefined;
    /** Icon theme name used for the action. */
    icon?: string | undefined;
};

const desktopActionSchema = z.strictObject({
    name: text("must be an action name"),
    args: textList("argument", "must be an array of arguments appended to Exec").optional(),
    icon: text("must be an icon name").optional(),
}) satisfies z.ZodType<DeployDesktopActionOptions>;

/** The `deploy.branding` colors software centers use around the application's listing. */
type DeployBrandingOptions = {
    /** Primary AppStream branding color for light mode, in `#rrggbb` format. */
    light: string;
    /** Primary AppStream branding color for dark mode, in `#rrggbb` format. */
    dark: string;
};

const brandingSchema = z.strictObject({
    light: hexColorSchema,
    dark: hexColorSchema,
}) satisfies z.ZodType<DeployBrandingOptions>;

/**
 * A `deploy.extraFiles` entry in object form: the source file or directory, resolved against the project root,
 * that is installed at the entry's prefix-relative destination, and the octal mode it is installed with.
 */
type DeployExtraFileOptions = {
    /** Source file or directory path, resolved relative to the project root. */
    source: string;
    /** Octal file mode, applied to every file of a directory source. Setuid and setgid bits are rejected. */
    mode?: string | undefined;
};

const extraFileSchema = z.strictObject({
    source: text(SOURCE_PATH_ERROR),
    mode: z
        .string({ error: FILE_MODE_ERROR })
        .regex(FILE_MODE_PATTERN, { error: FILE_MODE_ERROR })
        .refine((mode) => (Number.parseInt(mode, FILE_MODE_RADIX) & PRIVILEGED_FILE_MODE_MASK) === 0, {
            error: FILE_MODE_ERROR,
        })
        .optional(),
}) satisfies z.ZodType<DeployExtraFileOptions>;

const extraFileEntrySchema = z.union([text(SOURCE_PATH_ERROR), extraFileSchema], { error: EXTRA_FILE_ERROR });

const launcherEnvSchema = z.record(
    z.string({ error: LAUNCHER_ENV_NAME_ERROR }).regex(LAUNCHER_ENV_NAME_PATTERN, { error: LAUNCHER_ENV_NAME_ERROR }),
    z.string({ error: LAUNCHER_ENV_ERROR }).refine((value) => !value.includes("\0"), { error: LAUNCHER_ENV_ERROR }),
    { error: (issue) => (issue.code === "invalid_key" ? LAUNCHER_ENV_NAME_ERROR : LAUNCHER_ENV_ERROR) },
);

const nodeFlagsSchema = z.array(
    z
        .string({ error: NODE_FLAG_ERROR })
        .refine((value) => value.startsWith("-") && !value.includes("\0"), { error: NODE_FLAG_ERROR }),
    { error: "must be an array of Node.js flags" },
);

/**
 * The `deploy.node` options: where the Node.js runtime bundled with the application comes from, the version it
 * is expected to be, whether its binary is stripped, and whether the launcher enables the compile cache.
 */
type DeployNodeOptions = {
    /** Runtime source: an official download, the running Node.js executable, or `path`. Defaults to `download`. */
    source?: "download" | "host" | "path" | undefined;
    /** Expected Node.js version. Downloaded runtimes default to exactly 26.8.2 when omitted. */
    version?: string | undefined;
    /** Node.js executable path relative to the project root, required when `source` is `path`. */
    path?: string | undefined;
    /** Strip the runtime when its architecture matches the host and `strip` is available. Defaults to `true`. */
    shouldStrip?: boolean | undefined;
    /** Enable Node.js compile caching in the generated launcher. Defaults to `true`. */
    shouldUseCompileCache?: boolean | undefined;
};

const nodeRuntimeSchema = z.strictObject({
    source: z.enum(NODE_SOURCES, { error: "must be one of download, host, path" }).optional(),
    version: text("must be a Node.js version such as 26.7.0").optional(),
    path: text("must be a path to a node binary").optional(),
    shouldStrip: flag(BOOLEAN_ERROR).optional(),
    shouldUseCompileCache: flag(BOOLEAN_ERROR).optional(),
}) satisfies z.ZodType<DeployNodeOptions>;

/**
 * The `deploy.scripts` options: maintainer scripts for Debian and RPM packages. Each value is a path to a
 * shell script file, not inline shell; the package carries the file's content.
 */
type DeployScriptsOptions = {
    /** Path to a shell script, relative to the project root, run before installing a Debian or RPM package. */
    preInstall?: string | undefined;
    /** Path to a shell script, relative to the project root, run after installing a Debian or RPM package. */
    postInstall?: string | undefined;
    /** Path to a shell script, relative to the project root, run before removing a Debian or RPM package. */
    preRemove?: string | undefined;
    /** Path to a shell script, relative to the project root, run after removing a Debian or RPM package. */
    postRemove?: string | undefined;
};

const scriptsSchema = z.strictObject({
    preInstall: text(SCRIPT_ERROR).optional(),
    postInstall: text(SCRIPT_ERROR).optional(),
    preRemove: text(SCRIPT_ERROR).optional(),
    postRemove: text(SCRIPT_ERROR).optional(),
}) satisfies z.ZodType<DeployScriptsOptions>;

/** The `deploy.tools` options: executables `gtkx deploy` runs instead of the ones it downloads. */
type DeployToolsOptions = {
    /** nFPM executable name or path relative to the project root. Defaults to a verified pinned download. */
    nfpm?: string | undefined;
};

const toolsSchema = z.strictObject({
    nfpm: text("must be an nFPM executable name or path").optional(),
}) satisfies z.ZodType<DeployToolsOptions>;

/** The `deploy.deb` options: Debian package metadata and compression. */
type DeployDebOptions = {
    /** Debian package name. Defaults to `deploy.binaryName`. */
    packageName?: string | undefined;
    /** Debian archive section, derived from the application categories when omitted. */
    section?: string | undefined;
    /** Debian package priority. Defaults to `optional`. */
    priority?: string | undefined;
    /** Compression used for the Debian package payload. */
    compression?: "gzip" | "none" | "xz" | "zstd" | undefined;
    /** Additional Debian control fields, keyed by field name. */
    fields?: Record<string, string> | undefined;
};

const debSchema = z.strictObject({
    packageName: text("must be a Debian package name").optional(),
    section: text("must be a Debian archive section").optional(),
    priority: text("must be a Debian priority").optional(),
    compression: z.enum(DEB_COMPRESSIONS, { error: "must be one of gzip, none, xz, zstd" }).optional(),
    fields: textRecord("must be a control field value", "must be a record of control field names to values").optional(),
}) satisfies z.ZodType<DeployDebOptions>;

/** The `deploy.rpm` options: RPM package metadata and compression. */
type DeployRpmOptions = {
    /** RPM package name. Defaults to `deploy.binaryName`. */
    packageName?: string | undefined;
    /** RPM package group, derived from the application categories when omitted. */
    group?: string | undefined;
    /** Compression used for the RPM package payload. */
    compression?: "gzip" | "lzma" | "xz" | "zstd" | undefined;
    /** Installation prefixes that the RPM package allows users to relocate. */
    prefixes?: string[] | undefined;
};

const rpmSchema = z.strictObject({
    packageName: text("must be an RPM package name").optional(),
    group: text("must be an RPM group").optional(),
    compression: z.enum(RPM_COMPRESSIONS, { error: "must be one of gzip, lzma, xz, zstd" }).optional(),
    prefixes: textList("prefix", "must be an array of relocation prefixes").optional(),
}) satisfies z.ZodType<DeployRpmOptions>;

/** The `deploy.appimage` options: AppImage file name, compression, update information and runtime. */
type DeployAppImageOptions = {
    /** Output file name, derived from the application name, version, and architecture when omitted. */
    fileName?: string | undefined;
    /** Compression explicitly requested from appimagetool. */
    compression?: "zstd" | undefined;
    /** AppImage update information string embedded in the executable. */
    updateInformation?: string | undefined;
    /** Custom AppImage runtime file path, resolved relative to the project root. */
    runtimeFile?: string | undefined;
};

const appimageSchema = z.strictObject({
    fileName: text("must be an output file name").optional(),
    compression: z.literal("zstd", { error: "must be zstd" }).optional(),
    updateInformation: text("must be an AppImage update information string").optional(),
    runtimeFile: text("must be a path to an AppImage runtime file").optional(),
}) satisfies z.ZodType<DeployAppImageOptions>;

/** The `deploy.flatpak.source` options: the Git revision a source-mode Flatpak builds. */
type DeployFlatpakSourceOptions = {
    /** Public HTTP or HTTPS Git repository URL. Defaults to the project's Git remote. */
    url?: string | undefined;
    /** Git tag to build, pinned to its commit when `commit` is omitted. */
    tag?: string | undefined;
    /** Git commit to build. Defaults to the configured tag's commit or the current HEAD. */
    commit?: string | undefined;
};

const flatpakSourceSchema = z.strictObject({
    url: url("must be an absolute git URL").optional(),
    tag: text("must be a git tag").optional(),
    commit: text("must be a git commit sha").optional(),
}) satisfies z.ZodType<DeployFlatpakSourceOptions>;

/** The `deploy.flatpak` options: runtime, sandbox permissions, build and distribution of the Flatpak. */
type DeployFlatpakOptions = {
    /** Package local build output or build from a pinned Git source inside the SDK. Defaults to `prebuilt`. */
    mode?: "prebuilt" | "source" | undefined;
    /** Flatpak runtime ID. Defaults to `org.gnome.Platform`. */
    runtime?: string | undefined;
    /** Flatpak runtime branch. Defaults to `51`. */
    runtimeVersion?: string | undefined;
    /** Build SDK ID. Defaults to `org.gnome.Sdk`. */
    sdk?: string | undefined;
    /** Node.js SDK extension used in source mode. Defaults to `org.freedesktop.Sdk.Extension.node26`. */
    nodeExtension?: string | undefined;
    /** Additional SDK extension IDs included in the build environment. */
    sdkExtensions?: string[] | undefined;
    /** Optional Flatpak base application ID. */
    base?: string | undefined;
    /** Branch of the base application. */
    baseVersion?: string | undefined;
    /** Exported application branch. Defaults to `stable`. */
    branch?: string | undefined;
    /** Sandbox permissions added to display, IPC, and GPU defaults. Negations remove matching defaults. */
    finishArgs?: string[] | undefined;
    /** Patterns added to header, pkg-config, and static-library cleanup defaults. An empty array disables cleanup. */
    cleanup?: string[] | undefined;
    /** Additional shell commands appended to the application's Flatpak build commands. */
    buildCommands?: string[] | undefined;
    /** Additional Flatpak manifest modules built before the application module. */
    modules?: unknown[] | undefined;
    /** Git repository and revision used for source builds. */
    source?: DeployFlatpakSourceOptions | undefined;
    /** Package manager used for offline source builds, detected from the project's lockfiles when omitted. */
    packageManager?: "npm" | "pnpm" | "yarn" | undefined;
    /** Lockfile path relative to the project root. Defaults to the selected package manager's standard lockfile. */
    lockfile?: string | undefined;
    /** Runtime repository URL embedded in the bundle. Defaults to Flathub's `.flatpakrepo` URL. */
    runtimeRepo?: string | undefined;
    /** Emit a `.flatpak` bundle in addition to the local repository. Defaults to `true`. */
    shouldEmitBundle?: boolean | undefined;
    /** Install the built application into the current user's Flatpak installation. Defaults to `false`. */
    shouldInstall?: boolean | undefined;
    /** Allow flatpak-builder to use rofiles-fuse. Set to `false` where FUSE is unavailable. */
    shouldUseRofilesFuse?: boolean | undefined;
};

const flatpakSchema = z.strictObject({
    mode: z.enum(FLATPAK_MODES, { error: 'must be "prebuilt" or "source"' }).optional(),
    runtime: text("must be a runtime id").optional(),
    runtimeVersion: text('must be a runtime branch such as "51"').optional(),
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
}) satisfies z.ZodType<DeployFlatpakOptions>;

/** The `deploy.signing.deb` options: the key and method that sign the Debian package. */
type DeployDebSigningOptions = {
    /** PGP private key file used to sign the Debian package. */
    keyFile: string;
    /** PGP signing key ID. */
    keyId?: string | undefined;
    /** Debian package signing method. */
    method?: "debsign" | "dpkg-sig" | undefined;
    /** Debian signature role. */
    type?: "archive" | "maint" | "origin" | undefined;
    /** Name and email address recorded as the signer. */
    signer?: string | undefined;
};

const debSigningSchema = z.strictObject({
    keyFile: text(KEY_FILE_ERROR),
    keyId: text(KEY_ID_ERROR).optional(),
    method: z.enum(DEB_SIGN_METHODS, { error: 'must be "debsign" or "dpkg-sig"' }).optional(),
    type: z.enum(DEB_SIGN_TYPES, { error: "must be one of archive, maint, origin" }).optional(),
    signer: text("must be a signer name and email").optional(),
}) satisfies z.ZodType<DeployDebSigningOptions>;

/** The `deploy.signing.rpm` options: the key that signs the RPM package. */
type DeployRpmSigningOptions = {
    /** PGP private key file used to sign the RPM package. */
    keyFile: string;
    /** PGP signing key ID. */
    keyId?: string | undefined;
};

const rpmSigningSchema = z.strictObject({
    keyFile: text(KEY_FILE_ERROR),
    keyId: text(KEY_ID_ERROR).optional(),
}) satisfies z.ZodType<DeployRpmSigningOptions>;

/** The `deploy.signing.flatpak` options: the GPG key that signs the Flatpak repository commit. */
type DeployFlatpakSigningOptions = {
    /**
     * GPG key ID that signs the Flatpak repository commit. The bundle embeds its public key, so
     * `flatpak install --bundle` verifies the signature.
     */
    gpgKeyId: string;
    /** GPG home directory containing the signing key. */
    gpgHomeDir?: string | undefined;
};

const flatpakSigningSchema = z.strictObject({
    gpgKeyId: text("must be a GPG key id"),
    gpgHomeDir: text("must be a path to a GPG home directory").optional(),
}) satisfies z.ZodType<DeployFlatpakSigningOptions>;

/** The `deploy.signing.appimage` options: the GPG key that signs the AppImage. */
type DeployAppImageSigningOptions = {
    /** GPG key ID used by appimagetool to sign the AppImage. */
    gpgKeyId: string;
};

const appimageSigningSchema = z.strictObject({
    gpgKeyId: text("must be a GPG key id"),
}) satisfies z.ZodType<DeployAppImageSigningOptions>;

/** The `deploy.signing` options: how each package format is signed. Formats without an entry stay unsigned. */
type DeploySigningOptions = {
    /** AppImage signing options. */
    appimage?: DeployAppImageSigningOptions | undefined;
    /** Debian package signing options. */
    deb?: DeployDebSigningOptions | undefined;
    /** Flatpak bundle signing options. */
    flatpak?: DeployFlatpakSigningOptions | undefined;
    /** RPM package signing options. */
    rpm?: DeployRpmSigningOptions | undefined;
};

const signingSchema = z.strictObject({
    appimage: appimageSigningSchema.optional(),
    deb: debSigningSchema.optional(),
    flatpak: flatpakSigningSchema.optional(),
    rpm: rpmSigningSchema.optional(),
}) satisfies z.ZodType<DeploySigningOptions>;

/** The `deploy.relations` options: package relationships besides dependencies, for Debian and RPM. */
type DeployRelationsOptions = {
    /** Recommended packages that extend the application's functionality. */
    recommends?: DeployPackageRelationOptions | undefined;
    /** Suggested companion packages. */
    suggests?: DeployPackageRelationOptions | undefined;
    /** Package names or capabilities supplied by this package. */
    provides?: DeployPackageRelationOptions | undefined;
    /** Packages that cannot be installed alongside this package. */
    conflicts?: DeployPackageRelationOptions | undefined;
    /** Packages whose files this package may replace. */
    replaces?: DeployPackageRelationOptions | undefined;
    /** Debian packages made incompatible by installing this package. Debian packages only. */
    breaks?: DeployDebPackageRelationOptions | undefined;
    /** Debian dependencies required before unpacking this package. Debian packages only. */
    preDepends?: DeployDebPackageRelationOptions | undefined;
};

const extraRelationsSchema = z.strictObject({
    recommends: relationsSchema.optional(),
    suggests: relationsSchema.optional(),
    provides: relationsSchema.optional(),
    conflicts: relationsSchema.optional(),
    replaces: relationsSchema.optional(),
    breaks: debRelationsSchema.optional(),
    preDepends: debRelationsSchema.optional(),
}) satisfies z.ZodType<DeployRelationsOptions>;

/** The `deploy` options: application metadata, bundled runtime settings, and packaging options for `gtkx deploy`. */
type DeployOptions = {
    /** Package formats to build. Defaults to `["flatpak"]`; overridden by `gtkx deploy --target`. */
    targets?: ("appimage" | "deb" | "flatpak" | "rpm")[] | undefined;
    /** Target CPU architectures. Defaults to the host architecture; overridden by `gtkx deploy --arch`. */
    architectures?: ("arm64" | "x64")[] | undefined;
    /** Deployment directory relative to the project root. Defaults to `build`, with packages in its `out` directory. */
    outDir?: string | undefined;
    /** Display name, derived from package.json's name or the application ID when omitted. */
    name?: string | undefined;
    /** Generic application description shown by desktop launchers, such as `Text Editor`. */
    genericName?: string | undefined;
    /** Launcher command name, derived from package.json's name or the application ID when omitted. */
    binaryName?: string | undefined;
    /** Application version. Defaults to the version in package.json. */
    version?: string | undefined;
    /** Debian packaging revision and RPM release. Defaults to `1`. */
    release?: string | undefined;
    /** Non-negative Debian and RPM version epoch, omitted from package metadata unless configured. */
    epoch?: number | undefined;
    /** Single-line summary without a trailing period. Defaults to the first line of package.json's description. */
    summary?: string | undefined;
    /** Long description as paragraphs. Defaults to the summary when omitted or empty. */
    description?: string[] | undefined;
    /** Search keywords included in the desktop entry and AppStream metadata. */
    keywords?: string[] | undefined;
    /** Freedesktop application categories used by launchers, software centers, and package metadata. */
    categories?: string[] | undefined;
    /** Supported MIME types, combined with types from file associations and URL protocols. */
    mimeTypes?: string[] | undefined;
    /** Developer identity and package maintainer details. */
    developer?: DeployDeveloperOptions | undefined;
    /** Application license as an SPDX expression. Defaults to the license in package.json. */
    license?: string | undefined;
    /** License file path relative to the project root, detected from common LICENSE or COPYING names when omitted. */
    licenseFile?: string | undefined;
    /** SPDX license expression for the AppStream metadata. Defaults to `CC0-1.0`. */
    metadataLicense?: string | undefined;
    /** Copyright notice. Defaults to the build year and developer name. */
    copyright?: string | undefined;
    /** Application homepage URL. Defaults to the homepage in package.json. */
    homepage?: string | undefined;
    /** Additional AppStream links keyed by their purpose, such as `bugtracker` or `help`. */
    urls?:
        | Partial<
              Record<
                  "bugtracker" | "contact" | "contribute" | "donation" | "faq" | "help" | "translate" | "vcs-browser",
                  string
              >
          >
        | undefined;
    /** Screenshots for software centers. Each entry requires a `url` or `file`. */
    screenshots?: DeployScreenshotOptions[] | undefined;
    /** Base URL for screenshot files, inferred from a GitHub or GitLab remote when omitted. */
    screenshotBaseUrl?: string | undefined;
    /** Primary branding colors included in AppStream metadata. */
    branding?: DeployBrandingOptions | undefined;
    /** OARS 1.1 content-rating attributes mapped to their intensities. */
    contentRating?: Record<string, "intense" | "mild" | "moderate" | "none"> | undefined;
    /** AppStream release history, sorted newest first. Defaults to the application version and build date. */
    releases?: DeployReleaseOptions[] | undefined;
    /** Application arguments included in the desktop entry's launch command. */
    execArgs?: string[] | undefined;
    /** Environment variables exported by the generated launcher. Keys must be POSIX environment names. */
    launcherEnv?: Record<string, string> | undefined;
    /** Node.js flags placed before the application bundle in the generated launcher. */
    nodeFlags?: string[] | undefined;
    /** File extensions and MIME types registered for the application. */
    fileAssociations?: DeployFileAssociationOptions[] | undefined;
    /** URL schemes handled by the application, registered as `x-scheme-handler` MIME types. */
    protocols?: string[] | undefined;
    /**
     * Desktop launcher actions keyed by action ID. With `isDbusActivatable`, the application must register an
     * `app.<id>` action for each one.
     */
    desktopActions?: Record<string, DeployDesktopActionOptions> | undefined;
    /**
     * Additional desktop entry keys, overriding non-reserved generated values.
     * `DBusActivatable` and `Version` are rejected; use `deploy.isDbusActivatable` for D-Bus activation.
     */
    desktopEntry?: Record<string, string> | undefined;
    /** Additional XML fragments appended to the AppStream component. */
    metainfoExtra?: string[] | undefined;
    /** Enable D-Bus activation in the desktop entry and generate a session bus service file. Defaults to `false`. */
    isDbusActivatable?: boolean | undefined;
    /**
     * Extra files keyed by destination inside the install prefix, without a leading slash or a `..` segment.
     * Each value is a source path relative to the project root, or a {@link DeployExtraFileOptions} entry that
     * also sets the file mode. A directory source installs every file below it at the same path below the
     * destination; without a mode, each file is executable when its source is. Scripts installed this way, such
     * as a helper command's launcher, can run the bundled Node.js runtime at `lib/<binaryName>/node` in every
     * prebuilt target and in source Flatpaks.
     */
    extraFiles?: Record<string, string | DeployExtraFileOptions> | undefined;
    /** Minimum runtime library versions keyed by GIR library ID, used when deriving package dependencies. */
    minimumLibraryVersions?: Record<string, string> | undefined;
    /** Additional Debian and RPM dependencies merged with automatically detected dependencies. */
    depends?: DeployPackageRelationOptions | undefined;
    /** Additional package relationships for Debian and RPM. */
    relations?: DeployRelationsOptions | undefined;
    /** Installation and removal scripts for Debian and RPM packages. */
    scripts?: DeployScriptsOptions | undefined;
    /** Node.js runtime bundled with prebuilt packages and launcher compile-cache settings. */
    node?: DeployNodeOptions | undefined;
    /** Overrides for executables used to build packages. */
    tools?: DeployToolsOptions | undefined;
    /** Per-format package signing options. */
    signing?: DeploySigningOptions | undefined;
    /** AppImage packaging options. */
    appimage?: DeployAppImageOptions | undefined;
    /** Debian package metadata and compression options. */
    deb?: DeployDebOptions | undefined;
    /** Flatpak runtime, sandbox, build, and distribution options. */
    flatpak?: DeployFlatpakOptions | undefined;
    /** RPM package metadata and compression options. */
    rpm?: DeployRpmOptions | undefined;
};

const deploySchema = z.strictObject({
    targets: z
        .array(z.enum(DEPLOY_TARGET_NAMES, { error: "must be one of appimage, deb, flatpak, rpm" }), {
            error: "must be an array of deploy targets",
        })
        .optional(),
    architectures: z
        .array(z.enum(DEPLOY_ARCH_NAMES, { error: "must be one of arm64, x64" }), {
            error: "must be an array of deploy architectures",
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
    fileAssociations: z.array(fileAssociationSchema, { error: "must be an array of file associations" }).optional(),
    protocols: textList("URL scheme", "must be an array of URL schemes").optional(),
    desktopActions: z
        .record(z.string(), desktopActionSchema, { error: "must be a record of action ids to actions" })
        .optional(),
    desktopEntry: textRecord(
        "must be a desktop entry value",
        "must be a record of desktop entry keys to values",
    ).optional(),
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
    tools: toolsSchema.optional(),
    signing: signingSchema.optional(),
    appimage: appimageSchema.optional(),
    deb: debSchema.optional(),
    flatpak: flatpakSchema.optional(),
    rpm: rpmSchema.optional(),
}) satisfies z.ZodType<DeployOptions>;

export {
    deploySchema,
    type DeployAppImageOptions,
    type DeployAppImageSigningOptions,
    type DeployBrandingOptions,
    type DeployDebOptions,
    type DeployDebPackageRelationOptions,
    type DeployDebSigningOptions,
    type DeployDesktopActionOptions,
    type DeployDeveloperOptions,
    type DeployExtraFileOptions,
    type DeployFileAssociationOptions,
    type DeployFlatpakOptions,
    type DeployFlatpakSigningOptions,
    type DeployFlatpakSourceOptions,
    type DeployNodeOptions,
    type DeployOptions,
    type DeployPackageRelationOptions,
    type DeployRelationsOptions,
    type DeployReleaseOptions,
    type DeployRpmOptions,
    type DeployRpmSigningOptions,
    type DeployScreenshotOptions,
    type DeployScriptsOptions,
    type DeploySigningOptions,
    type DeployToolsOptions,
};
