/**
 * Represents a parsed path parameter
 */
export type PathParam = {
	name: string;
	value: string;
};

/**
 * Result of a path match operation
 */
export type MatchResult = {
	matched: boolean;
	params: Record<string, string>;
};

/**
 * Utility class for matching dynamic routes with parameters
 */
export class PathMatcher {
	/**
	 * Matches a path against a pattern with dynamic segments
	 *
	 * @param pattern - The route pattern (e.g., "/leaderboards/:id")
	 * @param path - The actual path to match (e.g., "/leaderboards/123")
	 * @returns MatchResult with matched status and extracted parameters
	 */
	static match(pattern: string, path: string): MatchResult {
		const patternSegments = pattern.split('/').filter(Boolean);
		const pathSegments = path.split('/').filter(Boolean);

		// If segment counts don't match, it's not a match
		if (patternSegments.length !== pathSegments.length) {
			return { matched: false, params: {} };
		}

		const params: Record<string, string> = {};

		for (let i = 0; i < patternSegments.length; i++) {
			const patternSegment = patternSegments[i];
			const pathSegment = pathSegments[i];

			if (patternSegment.startsWith(':')) {
				// Dynamic segment - extract parameter
				const paramName = patternSegment.slice(1);
				params[paramName] = pathSegment;
			} else if (patternSegment !== pathSegment) {
				// Static segment doesn't match
				return { matched: false, params: {} };
			}
		}

		return { matched: true, params };
	}

	/**
	 * Checks if a path matches a pattern with dynamic segments
	 *
	 * @param pattern - The route pattern (e.g., "/leaderboards/:id")
	 * @param path - The actual path to match (e.g., "/leaderboards/123")
	 * @returns True if the path matches the pattern, false otherwise
	 */
	static isMatch(pattern: string, path: string): boolean {
		const result = this.match(pattern, path);
		return result.matched;
	}

	/**
	 * Builds a path from a pattern by replacing parameters
	 *
	 * @param pattern - The route pattern (e.g., "/leaderboards/:id")
	 * @param params - Parameters to substitute (e.g., { id: "123" })
	 * @returns The built path (e.g., "/leaderboards/123")
	 */
	static build(pattern: string, params: Record<string, string>): string {
		let result = pattern;

		for (const [key, value] of Object.entries(params)) {
			result = result.replace(`:${key}`, value);
		}

		return result;
	}

	/**
	 * Extracts parameter names from a pattern
	 *
	 * @param pattern - The route pattern (e.g., "/leaderboards/:id/:category")
	 * @returns Array of parameter names (e.g., ["id", "category"])
	 */
	static getParams(pattern: string): string[] {
		return pattern
			.split('/')
			.filter((segment) => segment.startsWith(':'))
			.map((segment) => segment.slice(1));
	}
}
