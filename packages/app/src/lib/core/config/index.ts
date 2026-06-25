export {
	SCHEMA_VERSION,
	appSettingsSchema,
	accountSettingsSchema,
	settingsSchema,
	defaultSettings,
	validateSettings,
	type AppSettings,
	type AccountSettings,
	type FeatureSlice,
	type Settings
} from './schema';
export { migrateV1, migrateToCurrent, isV1Store, isV2Tree } from './migrations';
export { writeJsonAtomic, readJsonWithRecovery } from './fs-json';
export {
	Paths,
	validateWarningsLog,
	validateGameDir,
	detectWarningsLog,
	detectGameDir,
	type PathValidation
} from './paths';
export { BackupService, type BackupCandidate, type BackupReason } from './backup';
export {
	createEnvelope,
	createFeatureEnvelope,
	parseImportContent,
	parseFeatureImportContent,
	serializeEnvelope,
	ENVELOPE_KIND,
	type SettingsEnvelope,
	type ParseResult
} from './import-export';
export { settings, SettingsService, type SettingsLoadResult, type SettingsSource } from './settings.svelte';
