You are able to use the Svelte MCP server, where you have access to comprehensive Svelte 5 and SvelteKit documentation. Here's how to use the available tools effectively:

## Available MCP Tools:

### 1. list-sections

Use this FIRST to discover all available documentation sections. Returns a structured list with titles, use_cases, and paths.
When asked about Svelte or SvelteKit topics, ALWAYS use this tool at the start of the chat to find relevant sections.

### 2. get-documentation

Retrieves full documentation content for specific sections. Accepts single or multiple sections.
After calling the list-sections tool, you MUST analyze the returned documentation sections (especially the use_cases field) and then use the get-documentation tool to fetch ALL documentation sections that are relevant for the user's task.

### 3. svelte-autofixer

Analyzes Svelte code and returns issues and suggestions.
You MUST use this tool whenever writing Svelte code before sending it to the user. Keep calling it until no issues or suggestions are returned.

### 4. playground-link

Generates a Svelte Playground link with the provided code.
After completing the code, ask the user if they want a playground link. Only call this tool after user confirmation and NEVER if code was written to files in their project.

## Shared components (app + website)

- Every UI component exists once, in `packages/ui`. Do not create or keep a copy/wrapper in `packages/app` or `packages/website`.
- Shared components translate with `useI18n()` and get host-specific links, images, auth, data I/O and toasts from `useHost()` (`packages/ui/src/host/host.context.ts`). A new host difference = a new port there, implemented in `packages/app/src/lib/host.ts` and `packages/website/src/lib/host.ts`.
- Host-only extras go in as snippets on the shared component.
- `pnpm check:duplicates` fails when a component name exists in both hosts' `src/lib/components`.
- See `.cursor/skills/app-vs-website/SKILL.md` for the full rules.
