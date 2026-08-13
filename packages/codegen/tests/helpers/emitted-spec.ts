const sliceBetween = (source: string, opening: string, closing: string): string => {
    const start = source.indexOf(opening);

    if (start === -1) {
        throw new Error(`The generated source contains no ${opening}`);
    }

    const end = source.indexOf(closing, start);

    if (end === -1) {
        throw new Error(`The generated source never closes ${opening}`);
    }

    return source.slice(start, end);
};

const callDescriptorFor = (source: string, cIdentifier: string): string =>
    sliceBetween(source, `"${cIdentifier}", {`, "});");

const vtableSlotFor = (source: string, key: string): string => sliceBetween(source, `${key}: {`, "\n    },");
const memberSourceFor = (source: string, header: string): string => sliceBetween(source, header, "\n    }");
const switchCaseFor = (member: string, key: string): string => sliceBetween(member, `case "${key}": {`, ";");

export { callDescriptorFor, memberSourceFor, switchCaseFor, vtableSlotFor };
