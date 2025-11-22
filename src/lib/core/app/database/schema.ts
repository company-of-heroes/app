export abstract class Schema {
	abstract up(): Promise<void>;

	abstract down(): Promise<void>;
}
