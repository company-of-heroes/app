/**
 * Base for all server services. A service gets the request's `locals`; other
 * services and the shared clients come from `locals.services`, built on first use.
 * Only touch them inside methods, never in a constructor (services may depend on
 * each other in a cycle).
 */
export abstract class Service {
	constructor(protected readonly locals: App.Locals) {}

	protected get services() {
		return this.locals.services;
	}

	/** Superuser PocketBase client. */
	protected get pb() {
		return this.services.clients.pb;
	}

	protected get relic() {
		return this.services.clients.relic;
	}

	protected get steam() {
		return this.services.clients.steam;
	}

	protected get fetch() {
		return this.services.clients.fetch;
	}

	/** For PocketBase files: passes the api-gateway's per-IP download limit. */
	protected get fileFetch() {
		return this.services.clients.fileFetch;
	}
}
