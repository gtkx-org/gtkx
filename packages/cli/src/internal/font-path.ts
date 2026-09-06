import { createHash } from "node:crypto";
import { basename, extname } from "node:path";

const FONTS_DIR = "fonts";
const DIGEST_LENGTH = 8;

const fontFileName = (sourcePath: string, content: Buffer): string => {
    const extension = extname(sourcePath).toLowerCase();
    const stem = basename(sourcePath, extname(sourcePath));
    const digest = createHash("sha1").update(content).digest("hex").slice(0, DIGEST_LENGTH);

    return `${stem}-${digest}${extension}`;
};

export { fontFileName, FONTS_DIR };
