import { Surface } from "../generated/cairo/surface.js";
import { call } from "../native.js";
import { createFileSurface, INT_TYPE, LIB, SURFACE_T_NONE } from "./common.js";
import { enumToString, getEnumList } from "./enum-helpers.js";

export enum SvgUnit {
    USER = 0,
    EM = 1,
    EX = 2,
    PX = 3,
    IN = 4,
    CM = 5,
    MM = 6,
    PT = 7,
    PC = 8,
    PERCENT = 9,
}

export enum SvgVersion {
    VERSION_1_1 = 0,
    VERSION_1_2 = 1,
}

export class SvgSurface extends Surface {
    static override readonly glibTypeName: string = "CairoSurface";

    declare setDocumentUnit: (unit: SvgUnit) => void;
    declare getDocumentUnit: () => SvgUnit;
    declare restrictToVersion: (version: SvgVersion) => void;

    constructor(filename: string, widthInPoints: number, heightInPoints: number) {
        super(createFileSurface("cairo_svg_surface_create", filename, widthInPoints, heightInPoints));
    }
}

SvgSurface.prototype.setDocumentUnit = function (this: SvgSurface, unit: SvgUnit): void {
    call(
        LIB,
        "cairo_svg_surface_set_document_unit",
        [
            { type: SURFACE_T_NONE, value: this.handle },
            { type: INT_TYPE, value: unit },
        ],
        { type: "void" },
    );
};

SvgSurface.prototype.getDocumentUnit = function (this: SvgSurface): SvgUnit {
    return call(
        LIB,
        "cairo_svg_surface_get_document_unit",
        [{ type: SURFACE_T_NONE, value: this.handle }],
        INT_TYPE,
    ) as SvgUnit;
};

SvgSurface.prototype.restrictToVersion = function (this: SvgSurface, version: SvgVersion): void {
    call(
        LIB,
        "cairo_svg_surface_restrict_to_version",
        [
            { type: SURFACE_T_NONE, value: this.handle },
            { type: INT_TYPE, value: version },
        ],
        { type: "void" },
    );
};

export const svgGetVersions = (): SvgVersion[] => {
    return getEnumList<SvgVersion>("cairo_svg_get_versions");
};

export const svgVersionToString = (version: SvgVersion): string => {
    return enumToString("cairo_svg_version_to_string", version);
};
