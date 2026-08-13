import { createVirtualNamespace } from "./virtual-module.js";

const VIRTUAL_PREFIX = "\0gtkx-resources:";
const VIRTUAL_INIT = "\0gtkx-resources-init";
const BUNDLE_FILENAME = "gtkx.gresource";
const REL_SEPARATOR = "\0rel=";
const REFRESH_EXPORT = "__refresh";
const RESOURCE_PATH_EXPORT = "path";
const { isVirtual, toVirtualId, fromVirtualId } = createVirtualNamespace(VIRTUAL_PREFIX);

const escapeXml = (value: string): string =>
    value.replaceAll(/[<>&"']/g, (char) => {
        switch (char) {
            case "<": {
                return "&lt;";
            }
            case ">": {
                return "&gt;";
            }
            case "&": {
                return "&amp;";
            }
            case "\"": {
                return "&quot;";
            }
            default: {
                return "&apos;";
            }
        }
    });

export {
    VIRTUAL_INIT,
    BUNDLE_FILENAME,
    REL_SEPARATOR,
    REFRESH_EXPORT,
    RESOURCE_PATH_EXPORT,
    escapeXml,
    isVirtual,
    toVirtualId,
    fromVirtualId,
};
