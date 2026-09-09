import { createVirtualNamespace } from "./virtual-module.js";

const VIRTUAL_PREFIX = "\0gtkx-resources:";
const VIRTUAL_INIT = "\0gtkx-resources-init";
const BUNDLE_FILENAME = "gtkx.gresource";
const REL_SEPARATOR = "\0rel=";
const ICON_NAME_SEPARATOR = "\0icon=";
const REFRESH_EXPORT = "__refresh";
const REGISTER_REFRESH_EXPORT = "__registerRefresh";
const RESOURCE_PATH_EXPORT = "path";
const VIRTUAL_ID_RE = new RegExp(`^${VIRTUAL_PREFIX}`);
const VIRTUAL_INIT_RE = new RegExp(`^${VIRTUAL_INIT}$`);
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
    VIRTUAL_ID_RE,
    VIRTUAL_INIT,
    VIRTUAL_INIT_RE,
    BUNDLE_FILENAME,
    REL_SEPARATOR,
    ICON_NAME_SEPARATOR,
    REFRESH_EXPORT,
    REGISTER_REFRESH_EXPORT,
    RESOURCE_PATH_EXPORT,
    escapeXml,
    isVirtual,
    toVirtualId,
    fromVirtualId,
};
