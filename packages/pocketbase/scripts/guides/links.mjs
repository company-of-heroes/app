/** Markdown links to wiki pages; the guide renderer turns them into hover-preview links. */
export const unit = (name, slug) => `[${name}](/wiki/units/${slug})`;
export const upgrade = (name, slug) => `[${name}](/wiki/upgrades/${slug})`;
export const building = (name, slug) => `[${name}](/wiki/buildings/${slug})`;
export const commander = (name, slug) => `[${name}](/wiki/commanders/${slug})`;
export const map = (name, slug) => `[${name}](/wiki/maps/${slug})`;
