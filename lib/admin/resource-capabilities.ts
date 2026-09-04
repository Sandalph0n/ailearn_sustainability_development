export type CrudCapabilities = {
    create: boolean;
    view: boolean;
    update: boolean;
    delete: boolean;
};

export const FULL_CRUD_CAPABILITIES: CrudCapabilities = {
    create: true,
    view: true,
    update: true,
    delete: true,
};
