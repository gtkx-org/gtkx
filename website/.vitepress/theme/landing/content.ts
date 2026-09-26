import manifest from "../../../versions.json" with { type: "json" };
import { documentationLink, featuredVersion } from "../../versioning.js";

const REPO_URL = "https://github.com/gtkx-org/gtkx";
const LICENSE = "MPL-2.0";
const EXAMPLES_URL = `${REPO_URL}/tree/${featuredVersion.examplesRef}/examples`;
const CREATE_COMMAND = featuredVersion.status === "prerelease"
    ? `npm create gtkx@${manifest.packageVersion}`
    : "npm create gtkx@latest";
const docsLink = (path: string): string => documentationLink(featuredVersion, path);

export { CREATE_COMMAND, docsLink, EXAMPLES_URL, LICENSE, REPO_URL };
