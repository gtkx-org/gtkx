import type { DeployFileAssociation, DeploySettings } from "../types.js";
import { element, renderDocument, text, type XmlNode } from "./xml.js";

/* eslint-disable-next-line sonarjs/no-clear-text-protocols, unicorn/prefer-https --
   An XML namespace is a fixed identifier, not a URL to fetch: shared-mime-info only recognizes this exact string. */
const MIME_INFO_NAMESPACE = "http://www.freedesktop.org/standards/shared-mime-info";

const mimeTypeNode = (association: DeployFileAssociation): XmlNode =>
    element("mime-type", { type: association.mimeType }, [
        ...(association.description === null ? [] : [text("comment", association.description)]),
        { tag: "glob", attributes: { pattern: `*.${association.extension}` } },
    ]);

const renderMimePackage = (settings: DeploySettings): string | null => {
    if (settings.fileAssociations.length === 0) {
        return null;
    }

    return renderDocument(
        element(
            "mime-info",
            { xmlns: MIME_INFO_NAMESPACE },
            settings.fileAssociations.map((entry) => mimeTypeNode(entry)),
        ),
    );
};

export { renderMimePackage };
