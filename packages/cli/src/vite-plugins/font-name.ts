import { create, type Font } from "@cantoo/fontkit";

const familyName = (font: Font): string | null =>
    font.getName("wwsFamilyName") ?? font.getName("preferredFamily") ?? font.familyName;

const fontFamilyNames = (content: Buffer): string[] => {
    try {
        const opened = create(content);
        const fonts = "fonts" in opened ? opened.fonts : [opened];
        const names = fonts.map((font) => familyName(font)).filter((name) => name !== null);

        return [...new Set(names)];
    } catch {
        return [];
    }
};

export { fontFamilyNames };
