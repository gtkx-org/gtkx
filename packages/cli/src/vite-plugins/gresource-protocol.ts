/**
 * Wire-protocol constants and helpers shared between the GResource Vite
 * plugin and its test suite: the sentinel virtual-module ids the plugin
 * synthesizes, the compiled bundle filename, the resource-path separator,
 * and the manifest XML escaper.
 */

/** Prefix marking a synthesized virtual asset module id. */
export const VIRTUAL_PREFIX = "\0gtkx-gresources:";

/** Id of the synthesized virtual init module. */
export const VIRTUAL_INIT = "\0gtkx-gresources-init";

/** Filename of the compiled GResource bundle emitted at build end. */
export const BUNDLE_FILENAME = "gtkx.gresource";

/**
 * Separator joining a resolved asset's absolute path to its `#data/`-relative
 * resource path inside a synthesized virtual module id.
 */
export const REL_SEPARATOR = "\0rel=";

/**
 * XML-escapes the five reserved characters (`<`, `>`, `&`, `"`, `'`) used
 * inside the generated GResource manifest.
 *
 * @param value - Raw text to escape
 */
export const escapeXml = (value: string): string =>
    value.replaceAll(/[<>&"']/g, (char) => {
        switch (char) {
            case "<":
                return "&lt;";
            case ">":
                return "&gt;";
            case "&":
                return "&amp;";
            case '"':
                return "&quot;";
            default:
                return "&apos;";
        }
    });
