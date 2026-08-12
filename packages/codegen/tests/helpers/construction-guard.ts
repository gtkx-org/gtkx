const constructionGuard = (source: string, qualified: string): string => {
    const marker = `Cannot construct ${qualified} with new: `;
    const start = source.indexOf(marker);

    if (start === -1) {
        throw new Error(`No construction guard emitted for ${qualified}`);
    }

    return source.slice(start + marker.length, source.indexOf('"', start));
};

export { constructionGuard };
