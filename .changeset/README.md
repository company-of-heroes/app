# Changesets

This directory holds changesets for tracking package changes before a release.

## Workflow

1. After making changes to a package, run `pnpm changeset` from the workspace root
2. Select which packages were affected and the semver bump type (major/minor/patch)
3. Write a summary of the changes
4. Commit the generated changeset file alongside your code changes
5. When ready to release, run `pnpm version-packages` to bump versions and update CHANGELOGs
6. Run `pnpm release` to publish (for public packages) or `pnpm build` to ship
