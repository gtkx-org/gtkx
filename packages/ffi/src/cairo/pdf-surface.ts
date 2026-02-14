import type { NativeHandle } from "@gtkx/native";
import { Surface } from "../generated/cairo/surface.js";
import { call } from "../native.js";
import { DOUBLE_TYPE, INT_TYPE, LIB, SURFACE_T, SURFACE_T_NONE } from "./common.js";
import { enumToString, getEnumList } from "./enum-helpers.js";

export enum PdfMetadata {
    TITLE = 0,
    AUTHOR = 1,
    SUBJECT = 2,
    KEYWORDS = 3,
    CREATOR = 4,
    CREATE_DATE = 5,
    MOD_DATE = 6,
}

export enum PdfVersion {
    VERSION_1_4 = 0,
    VERSION_1_5 = 1,
    VERSION_1_6 = 2,
    VERSION_1_7 = 3,
    VERSION_2_0 = 4,
}

export enum PdfOutlineFlags {
    OPEN = 1,
    BOLD = 2,
    ITALIC = 4,
}

export class PdfSurface extends Surface {
    static override readonly glibTypeName: string = "CairoSurface";

    declare restrictToVersion: (version: PdfVersion) => void;
    declare addOutline: (parentId: number, name: string, linkAttribs: string, flags: PdfOutlineFlags) => number;

    constructor(filename: string, widthInPoints: number, heightInPoints: number) {
        super();
        this.handle = call(
            LIB,
            "cairo_pdf_surface_create",
            [
                { type: { type: "string", ownership: "full" }, value: filename },
                { type: DOUBLE_TYPE, value: widthInPoints },
                { type: DOUBLE_TYPE, value: heightInPoints },
            ],
            SURFACE_T,
        ) as NativeHandle;
    }

    setSize(widthInPoints: number, heightInPoints: number): void {
        call(
            LIB,
            "cairo_pdf_surface_set_size",
            [
                { type: SURFACE_T_NONE, value: this.handle },
                { type: DOUBLE_TYPE, value: widthInPoints },
                { type: DOUBLE_TYPE, value: heightInPoints },
            ],
            { type: "undefined" },
        );
    }

    setMetadata(metadata: PdfMetadata, value: string): void {
        call(
            LIB,
            "cairo_pdf_surface_set_metadata",
            [
                { type: SURFACE_T_NONE, value: this.handle },
                { type: INT_TYPE, value: metadata },
                { type: { type: "string", ownership: "full" }, value: value },
            ],
            { type: "undefined" },
        );
    }

    setPageLabel(label: string): void {
        call(
            LIB,
            "cairo_pdf_surface_set_page_label",
            [
                { type: SURFACE_T_NONE, value: this.handle },
                { type: { type: "string", ownership: "full" }, value: label },
            ],
            { type: "undefined" },
        );
    }

    setThumbnailSize(width: number, height: number): void {
        call(
            LIB,
            "cairo_pdf_surface_set_thumbnail_size",
            [
                { type: SURFACE_T_NONE, value: this.handle },
                { type: INT_TYPE, value: width },
                { type: INT_TYPE, value: height },
            ],
            { type: "undefined" },
        );
    }
}

PdfSurface.prototype.restrictToVersion = function (this: PdfSurface, version: PdfVersion): void {
    call(
        LIB,
        "cairo_pdf_surface_restrict_to_version",
        [
            { type: SURFACE_T_NONE, value: this.handle },
            { type: INT_TYPE, value: version },
        ],
        { type: "undefined" },
    );
};

PdfSurface.prototype.addOutline = function (
    this: PdfSurface,
    parentId: number,
    name: string,
    linkAttribs: string,
    flags: PdfOutlineFlags,
): number {
    return call(
        LIB,
        "cairo_pdf_surface_add_outline",
        [
            { type: SURFACE_T_NONE, value: this.handle },
            { type: INT_TYPE, value: parentId },
            { type: { type: "string", ownership: "full" }, value: name },
            { type: { type: "string", ownership: "full" }, value: linkAttribs },
            { type: INT_TYPE, value: flags },
        ],
        INT_TYPE,
    ) as number;
};

export const pdfGetVersions = (): PdfVersion[] => {
    return getEnumList<PdfVersion>("cairo_pdf_get_versions");
};

export const pdfVersionToString = (version: PdfVersion): string => {
    return enumToString("cairo_pdf_version_to_string", version);
};
