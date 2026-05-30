/**
 * Wire-protocol constants and helpers shared between the GResource Vite
 * plugin and its test suite: the sentinel virtual-module ids the plugin
 * synthesizes, the compiled bundle filename, the `?resource=` override
 * separator, and the manifest XML escaper.
 */

/** Prefix marking a synthesized virtual asset module id. */
export const VIRTUAL_PREFIX = "\0gtkx-gresources:";

/** Id of the synthesized virtual init module. */
export const VIRTUAL_INIT = "\0gtkx-gresources-init";

/** Filename of the compiled GResource bundle emitted at build end. */
export const BUNDLE_FILENAME = "gtkx.gresource";

/** Separator joining a resolved asset id to its `?resource=` override. */
export const OVERRIDE_SEPARATOR = "\0resource=";

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
