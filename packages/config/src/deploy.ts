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

const relationsSchema = z.strictObject({
    /** Package relations expressed in Debian dependency syntax. */
    deb: textList("Debian package relation", "must be an array of Debian package relations").optional(),
    /** Package relations expressed in RPM dependency syntax. */
    rpm: textList("RPM package relation", "must be an array of RPM package relations").optional(),
});

const developerSchema = z.strictObject({
    /** Reverse-DNS developer identifier, derived from the application ID when omitted. */
    id: text("must be a reverse-DNS developer id").optional(),
    /** Developer or organization name. Defaults to the author in package.json. */
    name: text("must be a developer or organization name").optional(),
    /** Maintainer email address. Defaults to the author's email in package.json. */
    email: text("must be an email address").optional(),
});

/** One software-center screenshot in `deploy.screenshots`. Either `url` or `file` must be set. */
type DeployScreenshotOptions = z.infer<typeof screenshotSchema>;

/** Screenshot entry schema and the source of {@link DeployScreenshotOptions}. */
const screenshotSchema = z
    .strictObject({
        /** Absolute URL of a PNG or JPEG screenshot. Takes precedence over `file`. */
        url: url("must be an absolute URL to a PNG or JPEG").optional(),
        /** Screenshot path relative to the project root, resolved against `screenshotBaseUrl`. */
        file: text("must be an image path relative to the project root").optional(),
        /** Caption displayed with the screenshot in software centers. */
        caption: text("must be a screenshot caption").optional(),
        /** Marks the primary screenshot. Only the first entry set to `true` is used. */
        isDefault: flag(BOOLEAN_ERROR).optional(),
    })
    .refine((entry) => entry.url !== undefined || entry.file !== undefined, {
        error: "must have either a `url` or a `file`",
    });

/** One AppStream release-history entry in `deploy.releases`. */
type DeployReleaseOptions = z.infer<typeof releaseSchema>;

/** Release-history entry schema and the source of {@link DeployReleaseOptions}. */
const releaseSchema = z.strictObject({
    /** Application version described by this release. */
    version: text(VERSION_ERROR),
    /** Release date in `YYYY-MM-DD` format. */
    date: z.iso.date({ error: "must be an ISO date (YYYY-MM-DD)" }),
    /** AppStream release classification. */
    type: z.enum(RELEASE_TYPES, { error: "must be one of development, snapshot, stable" }).optional(),
    /** AppStream update urgency. */
    urgency: z.enum(RELEASE_URGENCIES, { error: "must be one of critical, high, low, medium" }).optional(),
    /** Release notes, with each entry rendered as a paragraph. */
    notes: textList("release note paragraph", "must be an array of release note paragraphs").optional(),
    /** Absolute URL containing further details about the release. */
    url: url(URL_ERROR).optional(),
});

/** One file extension and MIME type registered through `deploy.fileAssociations`. */
type DeployFileAssociationOptions = z.infer<typeof fileAssociationSchema>;

/** File association schema and the source of {@link DeployFileAssociationOptions}. */
const fileAssociationSchema = z.strictObject({
    /** File extension to associate with the application, without a leading dot. */
    extension: fileExtension("must be a file extension without a leading dot"),
    /** MIME type registered for the file extension. */
    mimeType: text("must be a MIME type such as text/plain"),
    /** Human-readable description of the file type. */
    description: text("must be a description of the file type").optional(),
});

/** One desktop launcher action in `deploy.desktopActions`, keyed by its action ID. */
type DeployDesktopActionOptions = z.infer<typeof desktopActionSchema>;

/** Desktop launcher action schema and the source of {@link DeployDesktopActionOptions}. */
const desktopActionSchema = z.strictObject({
    /** Action label shown in the desktop launcher menu. */
    name: text("must be an action name"),
    /** Arguments passed to the application when the action is activated. */
    args: textList("argument", "must be an array of arguments appended to Exec").optional(),
    /** Icon theme name used for the action. */
    icon: text("must be an icon name").optional(),
});

const brandingSchema = z.strictObject({
    /** Primary AppStream branding color for light mode, in `#rrggbb` format. */
    light: hexColorSchema,
    /** Primary AppStream branding color for dark mode, in `#rrggbb` format. */
    dark: hexColorSchema,
});

/**
 * A `deploy.extraFiles` entry in object form: the source file, resolved against the project root, that is
 * installed at the entry's prefix-relative destination, and the octal mode it is installed with.
 */
type DeployExtraFileOptions = {
    /** Source file path, resolved relative to the project root. */
    source: string;
    /** Octal file mode. Setuid and setgid bits are rejected. */
    mode?: string | undefined;
};
const extraFileSchema: z.ZodType<DeployExtraFileOptions> = z.strictObject({
    /** Source file path, resolved relative to the project root. */
    source: text(SOURCE_PATH_ERROR),
    /** Octal file mode. Setuid and setgid bits are rejected. */
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
const nodeRuntimeSchema: z.ZodType<DeployNodeOptions> = z.strictObject({
    /** Runtime source: an official download, the running Node.js executable, or `path`. Defaults to `download`. */
    source: z.enum(NODE_SOURCES, { error: "must be one of download, host, path" }).optional(),
    /** Expected Node.js version. Downloaded runtimes default to exactly 26.8.2 when omitted. */
    version: text("must be a Node.js version such as 26.7.0").optional(),
    /** Node.js executable path relative to the project root, required when `source` is `path`. */
    path: text("must be a path to a node binary").optional(),
    /** Strip the runtime when its architecture matches the host and `strip` is available. Defaults to `true`. */
    shouldStrip: flag(BOOLEAN_ERROR).optional(),
    /** Enable Node.js compile caching in the generated launcher. Defaults to `true`. */
    shouldUseCompileCache: flag(BOOLEAN_ERROR).optional(),
});

const scriptsSchema = z.strictObject({
    /** Shell script run before installing a Debian or RPM package. */
    preInstall: text(SCRIPT_ERROR).optional(),
    /** Shell script run after installing a Debian or RPM package. */
    postInstall: text(SCRIPT_ERROR).optional(),
    /** Shell script run before removing a Debian or RPM package. */
    preRemove: text(SCRIPT_ERROR).optional(),
    /** Shell script run after removing a Debian or RPM package. */
    postRemove: text(SCRIPT_ERROR).optional(),
});

const toolsSchema = z.strictObject({
    /** nFPM executable name or path relative to the project root. Defaults to a verified pinned download. */
    nfpm: text("must be an nFPM executable name or path").optional(),
});

const debSchema = z.strictObject({
    /** Debian package name. Defaults to `deploy.binaryName`. */
    packageName: text("must be a Debian package name").optional(),
    /** Debian archive section, derived from the application categories when omitted. */
    section: text("must be a Debian archive section").optional(),
    /** Debian package priority. Defaults to `optional`. */
    priority: text("must be a Debian priority").optional(),
    /** Compression used for the Debian package payload. */
    compression: z.enum(DEB_COMPRESSIONS, { error: "must be one of gzip, none, xz, zstd" }).optional(),
    /** Additional Debian control fields, keyed by field name. */
    fields: textRecord("must be a control field value", "must be a record of control field names to values").optional(),
});

const rpmSchema = z.strictObject({
    /** RPM package name. Defaults to `deploy.binaryName`. */
    packageName: text("must be an RPM package name").optional(),
    /** RPM package group, derived from the application categories when omitted. */
    group: text("must be an RPM group").optional(),
    /** Compression used for the RPM package payload. */
    compression: z.enum(RPM_COMPRESSIONS, { error: "must be one of gzip, lzma, xz, zstd" }).optional(),
    /** Installation prefixes that the RPM package allows users to relocate. */
    prefixes: textList("prefix", "must be an array of relocation prefixes").optional(),
});

const appimageSchema = z.strictObject({
    /** Output file name, derived from the application name, version, and architecture when omitted. */
    fileName: text("must be an output file name").optional(),
    /** Compression explicitly requested from appimagetool. */
    compression: z.literal("zstd", { error: "must be zstd" }).optional(),
    /** AppImage update information string embedded in the executable. */
    updateInformation: text("must be an AppImage update information string").optional(),
    /** Custom AppImage runtime file path, resolved relative to the project root. */
    runtimeFile: text("must be a path to an AppImage runtime file").optional(),
});

const flatpakSourceSchema = z.strictObject({
    /** Public HTTP or HTTPS Git repository URL. Defaults to the project's Git remote. */
    url: url("must be an absolute git URL").optional(),
    /** Git tag to build, pinned to its commit when `commit` is omitted. */
    tag: text("must be a git tag").optional(),
    /** Git commit to build. Defaults to the configured tag's commit or the current HEAD. */
    commit: text("must be a git commit sha").optional(),
});

const flatpakSchema = z.strictObject({
    /** Package local build output or build from a pinned Git source inside the SDK. Defaults to `prebuilt`. */
    mode: z.enum(FLATPAK_MODES, { error: 'must be "prebuilt" or "source"' }).optional(),
    /** Flatpak runtime ID. Defaults to `org.gnome.Platform`. */
    runtime: text("must be a runtime id").optional(),
    /** Flatpak runtime branch. Defaults to `50`. */
    runtimeVersion: text('must be a runtime branch such as "50"').optional(),
    /** Build SDK ID. Defaults to `org.gnome.Sdk`. */
    sdk: text("must be an SDK id").optional(),
    /** Node.js SDK extension used in source mode. Defaults to `org.freedesktop.Sdk.Extension.node26`. */
    nodeExtension: text("must be a Node SDK extension id").optional(),
    /** Additional SDK extension IDs included in the build environment. */
    sdkExtensions: textList("SDK extension id", "must be an array of SDK extension ids").optional(),
    /** Optional Flatpak base application ID. */
    base: text("must be a base app id").optional(),
    /** Branch of the base application. */
    baseVersion: text("must be a base app version").optional(),
    /** Exported application branch. Defaults to `stable`. */
    branch: text("must be a branch name").optional(),
    /** Sandbox permissions added to display, IPC, and GPU defaults. Negations remove matching defaults. */
    finishArgs: textList("finish argument", "must be an array of flatpak finish arguments").optional(),
    /** Patterns added to header, pkg-config, and static-library cleanup defaults. An empty array disables cleanup. */
    cleanup: textList("cleanup pattern", "must be an array of cleanup patterns").optional(),
    /** Additional shell commands appended to the application's Flatpak build commands. */
    buildCommands: textList("shell command", "must be an array of shell commands").optional(),
    /** Additional Flatpak manifest modules built before the application module. */
    modules: z.array(z.unknown(), { error: "must be an array of flatpak module objects" }).optional(),
    /** Git repository and revision used for source builds. */
    source: flatpakSourceSchema.optional(),
    /** Package manager used for offline source builds, detected from the project's lockfiles when omitted. */
    packageManager: z.enum(PACKAGE_MANAGERS, { error: "must be one of npm, pnpm, yarn" }).optional(),
    /** Lockfile path relative to the project root. Defaults to the selected package manager's standard lockfile. */
    lockfile: text("must be a path to a lockfile").optional(),
    /** Runtime repository URL embedded in the bundle. Defaults to Flathub's `.flatpakrepo` URL. */
    runtimeRepo: url("must be an absolute .flatpakrepo URL").optional(),
    /** Emit a `.flatpak` bundle in addition to the local repository. Defaults to `true`. */
    shouldEmitBundle: flag(BOOLEAN_ERROR).optional(),
    /** Install the built application into the current user's Flatpak installation. Defaults to `false`. */
    shouldInstall: flag(BOOLEAN_ERROR).optional(),
    /** Allow flatpak-builder to use rofiles-fuse. Set to `false` where FUSE is unavailable. */
    shouldUseRofilesFuse: flag(BOOLEAN_ERROR).optional(),
});

const debSigningSchema = z.strictObject({
    /** PGP private key file used to sign the Debian package. */
    keyFile: text(KEY_FILE_ERROR),
    /** PGP signing key ID. */
    keyId: text(KEY_ID_ERROR).optional(),
    /** Debian package signing method. */
    method: z.enum(DEB_SIGN_METHODS, { error: 'must be "debsign" or "dpkg-sig"' }).optional(),
    /** Debian signature role. */
    type: z.enum(DEB_SIGN_TYPES, { error: "must be one of archive, maint, origin" }).optional(),
    /** Name and email address recorded as the signer. */
    signer: text("must be a signer name and email").optional(),
});

const rpmSigningSchema = z.strictObject({
    /** PGP private key file used to sign the RPM package. */
    keyFile: text(KEY_FILE_ERROR),
    /** PGP signing key ID. */
    keyId: text(KEY_ID_ERROR).optional(),
});

const flatpakSigningSchema = z.strictObject({
    /** GPG key ID used to sign the Flatpak bundle. */
    gpgKeyId: text("must be a GPG key id"),
    /** GPG home directory containing the signing key. */
    gpgHomeDir: text("must be a path to a GPG home directory").optional(),
});

const appimageSigningSchema = z.strictObject({
    /** GPG key ID used by appimagetool to sign the AppImage. */
    gpgKeyId: text("must be a GPG key id"),
});

const signingSchema = z.strictObject({
    /** AppImage signing options. */
    appimage: appimageSigningSchema.optional(),
    /** Debian package signing options. */
    deb: debSigningSchema.optional(),
    /** Flatpak bundle signing options. */
    flatpak: flatpakSigningSchema.optional(),
    /** RPM package signing options. */
    rpm: rpmSigningSchema.optional(),
});

const extraRelationsSchema = z.strictObject({
    /** Recommended packages that extend the application's functionality. */
    recommends: relationsSchema.optional(),
    /** Suggested companion packages. */
    suggests: relationsSchema.optional(),
    /** Package names or capabilities supplied by this package. */
    provides: relationsSchema.optional(),
    /** Packages that cannot be installed alongside this package. */
    conflicts: relationsSchema.optional(),
    /** Packages whose files this package may replace. */
    replaces: relationsSchema.optional(),
    /** Debian packages made incompatible by installing this package. Uses the `deb` entries. */
    breaks: relationsSchema.optional(),
    /** Debian dependencies required before unpacking this package. Uses the `deb` entries. */
    preDepends: relationsSchema.optional(),
});

const deploySchema = z.strictObject({
    /** Package formats to build. Defaults to `["flatpak"]`; overridden by `gtkx deploy --target`. */
    targets: z
        .array(z.enum(DEPLOY_TARGET_NAMES, { error: "must be one of appimage, deb, flatpak, rpm" }), {
            error: "must be an array of deploy targets",
        })
        .optional(),
    /** Target CPU architectures. Defaults to the host architecture; overridden by `gtkx deploy --arch`. */
    architectures: z
        .array(z.enum(DEPLOY_ARCH_NAMES, { error: "must be one of arm64, x64" }), {
            error: "must be an array of deploy architectures",
        })
        .optional(),
    /** Deployment directory relative to the project root. Defaults to `build`, with packages in its `out` directory. */
    outDir: text("must be a directory path relative to the project root").optional(),
    /** Display name, derived from package.json's name or the application ID when omitted. */
    name: text("must be the display name shown in the launcher").optional(),
    /** Generic application description shown by desktop launchers, such as `Text Editor`. */
    genericName: text("must be a generic application name").optional(),
    /** Launcher command name, derived from package.json's name or the application ID when omitted. */
    binaryName: text("must be a kebab-case command name").optional(),
    /** Application version. Defaults to the version in package.json. */
    version: text(VERSION_ERROR).optional(),
    /** Debian packaging revision and RPM release. Defaults to `1`. */
    release: text("must be a packaging revision").optional(),
    /** Non-negative Debian and RPM version epoch, omitted from package metadata unless configured. */
    epoch: z.int({ error: EPOCH_ERROR }).min(0, { error: EPOCH_ERROR }).optional(),
    /** Single-line summary without a trailing period. Defaults to the first line of package.json's description. */
    summary: text("must be a single-line summary without a trailing period").optional(),
    /** Long description as paragraphs. Defaults to the summary when omitted or empty. */
    description: textList("description paragraph", "must be an array of description paragraphs").optional(),
    /** Search keywords included in the desktop entry and AppStream metadata. */
    keywords: textList("search keyword", "must be an array of search keywords").optional(),
    /** Freedesktop application categories used by launchers, software centers, and package metadata. */
    categories: textList("freedesktop category", "must be an array of freedesktop categories").optional(),
    /** Supported MIME types, combined with types from file associations and URL protocols. */
    mimeTypes: textList("MIME type", "must be an array of MIME types").optional(),
    /** Developer identity and package maintainer details. */
    developer: developerSchema.optional(),
    /** Application license as an SPDX expression. Defaults to the license in package.json. */
    license: text(SPDX_ERROR).optional(),
    /** License file path relative to the project root, detected from common LICENSE or COPYING names when omitted. */
    licenseFile: text("must be a path to a license file").optional(),
    /** SPDX license expression for the AppStream metadata. Defaults to `CC0-1.0`. */
    metadataLicense: text(SPDX_ERROR).optional(),
    /** Copyright notice. Defaults to the build year and developer name. */
    copyright: text("must be a copyright line").optional(),
    /** Application homepage URL. Defaults to the homepage in package.json. */
    homepage: url(URL_ERROR).optional(),
    /** Additional AppStream links keyed by their purpose, such as `bugtracker` or `help`. */
    urls: z
        .partialRecord(z.enum(URL_KINDS), url(URL_ERROR), {
            error: "must be a record of AppStream url kinds to URLs",
        })
        .optional(),
    /**
     * Screenshots for software centers. Each entry requires a `url` or `file`.
     * @see {@link DeployScreenshotOptions} for the fields accepted by each entry.
     */
    screenshots: z.array(screenshotSchema, { error: "must be an array of screenshots" }).optional(),
    /** Base URL for screenshot files, inferred from a GitHub or GitLab remote when omitted. */
    screenshotBaseUrl: url("must be an absolute base URL").optional(),
    /** Primary branding colors included in AppStream metadata. */
    branding: brandingSchema.optional(),
    /** OARS 1.1 content-rating attributes mapped to their intensities. */
    contentRating: z
        .record(z.string(), z.enum(OARS_INTENSITIES, { error: "must be one of intense, mild, moderate, none" }), {
            error: "must be a record of OARS 1.1 attribute ids to intensities",
        })
        .optional(),
    /**
     * AppStream release history, sorted newest first. Defaults to the application version and build date.
     * @see {@link DeployReleaseOptions} for the fields accepted by each entry.
     */
    releases: z.array(releaseSchema, { error: "must be an array of releases" }).optional(),
    /** Application arguments included in the desktop entry's launch command. */
    execArgs: textList("argument", "must be an array of arguments appended to Exec").optional(),
    /** Environment variables exported by the generated launcher. Keys must be POSIX environment names. */
    launcherEnv: launcherEnvSchema.optional(),
    /** Node.js flags placed before the application bundle in the generated launcher. */
    nodeFlags: nodeFlagsSchema.optional(),
    /**
     * File extensions and MIME types registered for the application.
     * @see {@link DeployFileAssociationOptions} for the fields accepted by each entry.
     */
    fileAssociations: z.array(fileAssociationSchema, { error: "must be an array of file associations" }).optional(),
    /** URL schemes handled by the application, registered as `x-scheme-handler` MIME types. */
    protocols: textList("URL scheme", "must be an array of URL schemes").optional(),
    /**
     * Desktop launcher actions keyed by action ID.
     * @see {@link DeployDesktopActionOptions} for the fields accepted by each entry.
     */
    desktopActions: z
        .record(z.string(), desktopActionSchema, { error: "must be a record of action ids to actions" })
        .optional(),
    /**
     * Additional desktop entry keys, overriding non-reserved generated values.
     * `DBusActivatable` and `Version` are rejected; use `deploy.isDbusActivatable` for D-Bus activation.
     */
    desktopEntry: textRecord(
        "must be a desktop entry value",
        "must be a record of desktop entry keys to values",
    ).optional(),
    /** Additional XML fragments appended to the AppStream component. */
    metainfoExtra: textList("AppStream XML fragment", "must be an array of AppStream XML fragments").optional(),
    /** Enable D-Bus activation in the desktop entry and generate a session bus service file. Defaults to `false`. */
    isDbusActivatable: flag(BOOLEAN_ERROR).optional(),
    /** Extra files keyed by destination inside the install prefix, with source paths relative to the project root. */
    extraFiles: relativePathRecord(
        "must be a destination path inside the install prefix, without a leading slash or a .. segment",
        extraFileEntrySchema,
        "must be a record of prefix-relative destinations to source paths or { source, mode } entries",
    ).optional(),
    /** Minimum runtime library versions keyed by GIR library ID, used when deriving package dependencies. */
    minimumLibraryVersions: minimumLibraryVersionsSchema.optional(),
    /** Additional Debian and RPM dependencies merged with automatically detected dependencies. */
    depends: relationsSchema.optional(),
    /** Additional package relationships for Debian and RPM. */
    relations: extraRelationsSchema.optional(),
    /** Installation and removal scripts for Debian and RPM packages. */
    scripts: scriptsSchema.optional(),
    /** Node.js runtime bundled with prebuilt packages and launcher compile-cache settings. */
    node: nodeRuntimeSchema.optional(),
    /** Overrides for executables used to build packages. */
    tools: toolsSchema.optional(),
    /** Per-format package signing options. */
    signing: signingSchema.optional(),
    /** AppImage packaging options. */
    appimage: appimageSchema.optional(),
    /** Debian package metadata and compression options. */
    deb: debSchema.optional(),
    /** Flatpak runtime, sandbox, build, and distribution options. */
    flatpak: flatpakSchema.optional(),
    /** RPM package metadata and compression options. */
    rpm: rpmSchema.optional(),
});

export {
    deploySchema,
    type DeployDesktopActionOptions,
    type DeployExtraFileOptions,
    type DeployFileAssociationOptions,
    type DeployNodeOptions,
    type DeployReleaseOptions,
    type DeployScreenshotOptions,
};
