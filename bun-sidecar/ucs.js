import fs from 'fs';

const logger = console; // Or use a more sophisticated logger

// Placeholder for Settings if you implement it fully later
// import { Settings } from './oppbot_settings.js';

class UCS {
	/**
	 * Processes language UCS file strings and the in-game symbolic aliases.
	 * @param {object} options
	 * @param {string} [options.ucsPath=null] - Direct path to the UCS file.
	 * @param {object} [options.settings=null] - Settings object containing the UCS path.
	 */
	constructor({ ucsPath = null, settings = null } = {}) {
		this.settings = settings || {}; // Use provided settings or an empty object
		this.ucsPath = ucsPath;
		// If ucsPath wasn't provided directly, try getting it from settings
		if (!this.ucsPath && this.settings.data && this.settings.data.cohUCSPath) {
			this.ucsPath = this.settings.data.cohUCSPath;
		}

		if (!this.ucsPath) {
			logger.warn('UCS path not provided or found in settings.');
			// Consider throwing an error or setting a default path if appropriate
			// throw new Error("UCS path is required.");
		} else if (!fs.existsSync(this.ucsPath)) {
			logger.warn(`UCS file not found at path: ${this.ucsPath}`);
			this.ucsPath = null; // Invalidate path if file doesn't exist
		}
	}

	/**
	 * Compares a symbolic string (e.g., "$12345") against entries in the UCS file.
	 * @param {string} compareString - The string to compare (e.g., "$12345").
	 * @returns {string | null} - The resolved string from the UCS file, or null if not found or an error occurs.
	 */
	compare_UCS(compareString) {
		if (!compareString || typeof compareString !== 'string' || !compareString.startsWith('$')) {
			// logger.debug(`Invalid compare string provided: ${compareString}`); // Optional debug log
			return compareString; // Return original if not a valid UCS string format
		}
		if (!this.ucsPath) {
			logger.error('Cannot compare UCS string: UCS file path is not set or invalid.');
			return compareString; // Return original string if path is invalid
		}

		try {
			const fileContent = fs.readFileSync(this.ucsPath, 'utf16le'); // Read as UTF-16 Little Endian
			const lines = fileContent.split('\n'); // Split into lines

			// Extract the numeric part of the compare string (e.g., "12345" from "$12345")
			const targetId = compareString.substring(1).trim();

			for (const line of lines) {
				const parts = line.split('\t'); // Split by tab
				if (parts.length >= 2) {
					const ucsId = parts[0].trim();
					if (ucsId === targetId) {
						// Found the matching ID, return the rest of the line joined by spaces
						const resolvedString = parts.slice(1).join(' ').trim();
						// logger.debug(`Resolved UCS string "${compareString}" to "${resolvedString}"`); // Optional debug log
						return resolvedString;
					}
				}
			}
			// logger.warn(`UCS string "${compareString}" (ID: ${targetId}) not found in ${this.ucsPath}`); // Optional warning
			return compareString; // Return original string if not found
		} catch (err) {
			logger.error(`Error reading or processing UCS file "${this.ucsPath}": ${err.message}`);
			// logger.error(err.stack); // Optional: log stack trace
			return compareString; // Return original string on error
		}
	}
}

export { UCS }; // Export the class
