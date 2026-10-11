export type ConfirmOptions = {
	/** Label of the confirm button (default "OK"). */
	confirm?: string;
	/** Label of the cancel button (default "Cancel"). */
	cancel?: string;
	/** The action destroys or takes something away: the confirm button turns red. */
	danger?: boolean;
};

type Request = { message: string; options: ConfirmOptions; resolve: (ok: boolean) => void };

/** One question at a time, answered in `<Modal />` (which renders the confirm dialog too). */
class Confirmation {
	open = $state(false);
	request = $state.raw<Request | null>(null);

	/** Resolves true on confirm, false on cancel, Escape or a newer question. */
	ask(message: string, options: ConfirmOptions = {}): Promise<boolean> {
		this.request?.resolve(false);
		return new Promise((resolve) => {
			let settled = false;
			this.request = {
				message,
				options,
				resolve: (ok) => {
					if (!settled) {
						settled = true;
						resolve(ok);
					}
				}
			};
			this.open = true;
		});
	}

	answer(ok: boolean) {
		this.open = false;
		this.request?.resolve(ok);
	}
}

export const confirmation = new Confirmation();
