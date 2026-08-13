type NamedEntity = {
    name: string;
    introspectable?: boolean | undefined;
};

const isEmittableEntity = (entity: NamedEntity): boolean => entity.name.length > 0 && entity.introspectable !== false;

export { isEmittableEntity };
