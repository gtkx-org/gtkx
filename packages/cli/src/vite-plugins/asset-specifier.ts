import { ASSET_PATH_RE, ASSET_RE } from "./asset-extensions.js";
import { stripQuery } from "./strip-query.js";

type ResourceSpecifier = {
    assetSource: string;
    resourcePath: string | null;
};

type IconSpecifier = {
    assetSource: string;
    iconName: string | null;
};

const RELATIVE_PREFIX_RE = /^\.\.?(?:\/|$)/;
const RESOURCE_QUERY_RE = /^resource(?:=([^&#]+))?$/;
const ICON_QUERY_RE = /^icon(?:=([^&#]+))?$/;
const URL_QUERY_RE = /(?:^|&)url(?:&|$)/;

const getQuery = (source: string): string | null => {
    const queryIndex = source.indexOf("?");

    return queryIndex === -1 ? null : source.slice(queryIndex + 1);
};

const isAssetSpecifier = (source: string): boolean => ASSET_PATH_RE.test(source);

const isBareRelativeAsset = (source: string): boolean =>
    getQuery(source) === null && RELATIVE_PREFIX_RE.test(source) && ASSET_RE.test(source);

const parseResourceSpecifier = (source: string): ResourceSpecifier | null => {
    const query = getQuery(source);
    const assetSource = stripQuery(source);

    if (query === null || !ASSET_RE.test(assetSource)) {
        return null;
    }

    const match = RESOURCE_QUERY_RE.exec(query);

    if (match === null) {
        return null;
    }

    return { assetSource, resourcePath: match[1] ?? null };
};

const parseIconSpecifier = (source: string): IconSpecifier | null => {
    const query = getQuery(source);
    const assetSource = stripQuery(source);

    if (query === null || !ASSET_RE.test(assetSource)) {
        return null;
    }

    const match = ICON_QUERY_RE.exec(query);

    if (match === null) {
        return null;
    }

    return { assetSource, iconName: match[1] ?? null };
};

const isUrlSpecifier = (source: string): boolean => {
    const query = getQuery(source);

    return query !== null && URL_QUERY_RE.test(query);
};

export {
    isAssetSpecifier,
    isBareRelativeAsset,
    isUrlSpecifier,
    parseIconSpecifier,
    parseResourceSpecifier,
};
