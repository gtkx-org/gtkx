import hostedGitInfo from "hosted-git-info";
import type { RecordedPackage } from "../../internal/build-manifest.js";
import type { PackageManifest } from "../settings/package-manifest.js";
import { copyrightLines, licenseTextIn } from "./text.js";

const authorLine = (manifest: PackageManifest): string[] => {
    const { name, email } = manifest.author;

    if (name === null) {
        return [];
    }

    return [email === null ? name : `${name} <${email}>`];
};

const sourceUrl = (manifest: PackageManifest): string | null => {
    const configured = manifest.repository ?? manifest.homepage;

    if (configured === null) {
        return null;
    }

    const url = configured.replace(/^git\+/, "").replace(/\.git$/, "").replace(/^git:\/\//, "https://");

    return hostedGitInfo.fromUrl(url)?.browse() ?? (url.startsWith("http") ? url : null);
};

const packageNotice = (dir: string, manifest: PackageManifest): Omit<RecordedPackage, "name" | "version"> => {
    const text = licenseTextIn(dir, manifest.license);
    const copyright = copyrightLines(text);

    return {
        license: manifest.license,
        source: sourceUrl(manifest),
        copyright: copyright.length === 0 ? authorLine(manifest) : copyright,
        text,
    };
};

export { packageNotice };
