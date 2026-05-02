/**
 * Documentation formatting utilities for TypeScript code generation.
 *
 * Converts GIR documentation to TSDoc format.
 */

type GirLinkType =
    | "class"
    | "iface"
    | "struct"
    | "enum"
    | "flags"
    | "error"
    | "callback"
    | "method"
    | "vfunc"
    | "func"
    | "ctor"
    | "property"
    | "signal"
    | "const"
    | "type"
    | "id";

interface GirLink {
    type: GirLinkType;
    namespace: string | undefined;
    target: string;
    member: string | undefined;
}

const GIR_LINK_PATTERN = /\[([a-z]+)@([^\]]+)\]/gi;

function parseGirLink(type: string, reference: string): GirLink | null {
    const linkType = type.toLowerCase() as GirLinkType;

    const validTypes: GirLinkType[] = [
        "class",
        "iface",
        "struct",
        "enum",
        "flags",
        "error",
        "callback",
        "method",
        "vfunc",
        "func",
        "ctor",
        "property",
        "signal",
        "const",
        "type",
        "id",
    ];

    if (!validTypes.includes(linkType)) {
        return null;
    }

    const parts = reference.split(".");
    if (parts.length === 0) {
        return null;
    }

    if (linkType === "property" || linkType === "signal") {
        const colonIndex = reference.indexOf(":");
        if (colonIndex !== -1) {
            const beforeColon = reference.substring(0, colonIndex);
            const afterColon = reference.substring(colonIndex + 1);
            const beforeParts = beforeColon.split(".");
            if (beforeParts.length >= 2) {
                return {
                    type: linkType,
                    namespace: beforeParts[0],
                    target: beforeParts.slice(1).join("."),
                    member: afterColon.replace("::", ""),
                };
            }
            return {
                type: linkType,
                namespace: undefined,
                target: beforeColon,
                member: afterColon.replace("::", ""),
            };
        }
    }

    if (parts.length === 1) {
        return {
            type: linkType,
            namespace: undefined,
            target: parts[0] ?? "",
            member: undefined,
        };
    }

    if (parts.length === 2) {
        const first = parts[0] ?? "";
        const second = parts[1] ?? "";
        const isNamespace = /^[A-Z]/.test(first);

        if (linkType === "func" || linkType === "const") {
            return {
                type: linkType,
                namespace: first,
                target: second,
                member: undefined,
            };
        }

        if (isNamespace) {
            return {
                type: linkType,
                namespace: first,
                target: second,
                member: undefined,
            };
        }

        return {
            type: linkType,
            namespace: undefined,
            target: first,
            member: second,
        };
    }

    return {
        type: linkType,
        namespace: parts[0],
        target: parts[1] ?? "",
        member: parts.slice(2).join(".") || undefined,
    };
}

interface LinkFormatOptions {
    linkStyle: "namespaced" | "prefixed";
    currentNamespace: string | undefined;
}

function buildGtkDocsUrl(link: GirLink, options: LinkFormatOptions): string | undefined {
    const namespace = link.namespace ?? options.currentNamespace;
    if (!namespace) {
        return undefined;
    }

    const baseUrl = getDocsBaseUrl(namespace);
    const member = link.member?.replace(/^:/, "");

    if (member) {
        return `${baseUrl}/${link.type}.${link.target}.${member}.html`;
    }

    return `${baseUrl}/${link.type}.${link.target}.html`;
}

function formatGirLinkForTsDoc(link: GirLink, options: LinkFormatOptions): string {
    let displayText: string;
    if (link.member) {
        displayText = `${link.target}.${link.member}`;
    } else {
        displayText = link.target;
    }

    let qualifiedName: string;
    if (options.linkStyle === "prefixed") {
        const effectiveNamespace = link.namespace ?? options.currentNamespace;
        if (effectiveNamespace && effectiveNamespace !== "Gtk") {
            qualifiedName = `${effectiveNamespace}${displayText}`;
        } else {
            qualifiedName = displayText;
        }
    } else {
        qualifiedName = link.namespace ? `${link.namespace}.${displayText}` : displayText;
    }

    const url = buildGtkDocsUrl(link, options);
    if (url) {
        return `[\`${qualifiedName}\`](${url})`;
    }

    return `\`${qualifiedName}\``;
}

function convertGirLinks(text: string, options: LinkFormatOptions): string {
    return text.replaceAll(GIR_LINK_PATTERN, (_, type: string, reference: string) => {
        const link = parseGirLink(type, reference);
        if (!link) {
            return `\`${reference}\``;
        }
        return formatGirLinkForTsDoc(link, options);
    });
}

const GTK_DOCS_BASE_URLS: Record<string, string> = {
    Gtk: "https://docs.gtk.org/gtk4",
    Gdk: "https://docs.gtk.org/gdk4",
    Gsk: "https://docs.gtk.org/gsk4",
    GLib: "https://docs.gtk.org/glib",
    GObject: "https://docs.gtk.org/gobject",
    Gio: "https://docs.gtk.org/gio",
    Pango: "https://docs.gtk.org/Pango",
    PangoCairo: "https://docs.gtk.org/PangoCairo",
    GdkPixbuf: "https://docs.gtk.org/gdk-pixbuf",
    Cairo: "https://docs.gtk.org/cairo",
    Adw: "https://gnome.pages.gitlab.gnome.org/libadwaita/doc/1-latest",
};

function getDocsBaseUrl(namespace: string | undefined): string {
    if (!namespace) {
        return "https://docs.gtk.org/gtk4";
    }
    const baseUrl = GTK_DOCS_BASE_URLS[namespace];
    if (baseUrl) {
        return baseUrl;
    }
    return `https://docs.gtk.org/${namespace.toLowerCase()}`;
}

function convertHtmlImageElements(text: string, baseUrl: string): string {
    let result = text;

    result = result.replaceAll(/<picture[^>]*>([\s\S]*?)<\/picture>/gi, (_, pictureContent: string) => {
        const imgMatch = /<img[^>]*alt="([^"]*)"[^>]*src="([^"]*)"[^>]*\/?>/i.exec(pictureContent);
        if (!imgMatch) {
            const imgMatch2 = /<img[^>]*src="([^"]*)"[^>]*alt="([^"]*)"[^>]*\/?>/i.exec(pictureContent);
            if (imgMatch2) {
                const src = imgMatch2[1];
                const alt = imgMatch2[2];
                return `![${alt}](${baseUrl}/${src})`;
            }
            return "";
        }
        const alt = imgMatch[1];
        const src = imgMatch[2];
        return `![${alt}](${baseUrl}/${src})`;
    });

    result = result.replaceAll(/<img[^>]*alt="([^"]*)"[^>]*src="([^"]*)"[^>]*\/?>/gi, (_, alt: string, src: string) => {
        if (src.startsWith("http://") || src.startsWith("https://")) {
            return `![${alt}](${src})`;
        }
        return `![${alt}](${baseUrl}/${src})`;
    });

    result = result.replaceAll(/<img[^>]*src="([^"]*)"[^>]*alt="([^"]*)"[^>]*\/?>/gi, (_, src: string, alt: string) => {
        if (src.startsWith("http://") || src.startsWith("https://")) {
            return `![${alt}](${src})`;
        }
        return `![${alt}](${baseUrl}/${src})`;
    });

    result = result.replaceAll(/<img[^>]*src="([^"]*)"[^>]*\/?>/gi, (_, src: string) => {
        if (src.startsWith("http://") || src.startsWith("https://")) {
            return `![](${src})`;
        }
        return `![](${baseUrl}/${src})`;
    });

    result = result.replaceAll(/<source[^>]*\/?>/gi, "");

    return result;
}

function convertMarkdownImageUrls(text: string, baseUrl: string): string {
    return text.replaceAll(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, alt: string, src: string) => {
        if (src.startsWith("http://") || src.startsWith("https://")) {
            return match;
        }
        return `![${alt}](${baseUrl}/${src})`;
    });
}

function convertKbdElements(text: string): string {
    return text.replaceAll(/<kbd>([^<]*)<\/kbd>/gi, "`$1`");
}

function stripHtmlLinks(text: string): string {
    return text.replaceAll(/\[([^\]]+)\]\([^)]+\.html[^)]*\)/gi, "$1");
}

function convertAtAnnotations(text: string): string {
    return text.replaceAll(/(?<!\{)@([a-zA-Z_][a-zA-Z0-9_]*)\b(?!\s*\{)/g, "`$1`");
}

function escapeXmlStyleTags(text: string): string {
    const codeBlockPattern = /```[\s\S]*?```/g;
    const codeBlocks: string[] = [];

    let processed = text.replaceAll(codeBlockPattern, (match) => {
        codeBlocks.push(match);
        return `__CODE_BLOCK_${codeBlocks.length - 1}__`;
    });

    processed = processed.replaceAll(
        /<(\/?)(child|object|property|signal|template|style|item|attribute)>/gi,
        "`<$1$2>`",
    );

    for (let i = 0; i < codeBlocks.length; i++) {
        processed = processed.replace(`__CODE_BLOCK_${i}__`, codeBlocks[i] ?? "");
    }

    return processed;
}

function cleanupWhitespace(text: string): string {
    let result = text.replaceAll(/\n{3,}/g, "\n\n");
    result = result.replaceAll(/[ \t]+$/gm, "");
    return result.trim();
}

interface SanitizeDocOptions {
    escapeXmlTags?: boolean;
    namespace?: string;
    linkStyle?: "namespaced" | "prefixed";
}

/**
 * Formats GIR documentation into a sanitized string suitable for JSDoc comments.
 *
 * @param doc - The raw documentation text from GIR
 * @param namespace - The namespace for link resolution
 * @returns The sanitized string, or undefined if no doc was provided
 */
export function formatJsDoc(doc: string | undefined, namespace: string): string | undefined {
    if (!doc) return undefined;
    return sanitizeDoc(doc, { namespace, escapeXmlTags: true });
}

/**
 * Builds a JSDoc structure array from documentation text.
 * Automatically escapes XML-style tags to prevent MDX compilation errors.
 *
 * @param doc - The documentation text
 * @param namespace - The namespace for link resolution
 * @returns Array with JSDoc structure or undefined if no doc
 */
export function buildJsDocStructure(
    doc: string | undefined,
    namespace: string,
): Array<{ description: string }> | undefined {
    if (!doc) return undefined;
    return [{ description: sanitizeDoc(doc, { namespace, escapeXmlTags: true }) }];
}

export function sanitizeDoc(doc: string, options: SanitizeDocOptions = {}): string {
    let result = doc;

    const baseUrl = getDocsBaseUrl(options.namespace);
    result = convertHtmlImageElements(result, baseUrl);
    result = convertMarkdownImageUrls(result, baseUrl);
    result = convertKbdElements(result);
    result = stripHtmlLinks(result);

    const linkFormatOptions: LinkFormatOptions = {
        linkStyle: options.linkStyle ?? "namespaced",
        currentNamespace: options.namespace,
    };
    result = convertGirLinks(result, linkFormatOptions);
    result = convertAtAnnotations(result);

    if (options.escapeXmlTags) {
        result = escapeXmlStyleTags(result);
    }

    result = cleanupWhitespace(result);

    return result;
}
