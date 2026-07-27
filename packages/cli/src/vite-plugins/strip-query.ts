const stripQuery = (source: string): string => {
    const queryIndex = source.indexOf("?");

    return queryIndex === -1 ? source : source.slice(0, queryIndex);
};

export { stripQuery };
