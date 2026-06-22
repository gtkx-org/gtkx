import { createVirtualNamespace } from "./virtual-module.js";

export const VIRTUAL_PREFIX = "\0gtkx-gresources:";

export const VIRTUAL_INIT = "\0gtkx-gresources-init";

export const BUNDLE_FILENAME = "gtkx.gresource";

export const REL_SEPARATOR = "\0rel=";

export const { isVirtual, toVirtualId, fromVirtualId } = createVirtualNamespace(VIRTUAL_PREFIX);

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
