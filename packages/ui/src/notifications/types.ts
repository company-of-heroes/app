/** A notification as the bell lists it (app and website). */
export type HostNotification = {
	id: string;
	title: string;
	/** Markdown. */
	body: string;
	created: string;
	read: boolean;
	lobby?: string;
	comment?: string;
	replay?: string;
	replayComment?: string;
	/** Page the notification is about (absolute website URL), e.g. a tournament or wiki page. */
	url?: string;
	tournament?: string;
};
