import { DATA_IMPORT_PREFIX } from "../internal/data-dir.js";
import { ASSET_PATH_RE, ASSET_RE } from "./asset-extensions.js";

const DATA_PREFIX = `${DATA_IMPORT_PREFIX}/`;

const isAssetSpecifier = (source: string): boolean => ASSET_PATH_RE.test(source);
const isDataAsset = (source: string): boolean => source.startsWith(DATA_PREFIX) && ASSET_RE.test(source);

export { DATA_PREFIX, isAssetSpecifier, isDataAsset };
