import DialogHost from './root.svelte';
import { dialog } from './dialog.svelte';
import DialogRoot from './dialog-root.svelte';
import DialogTrigger from './dialog-trigger.svelte';
import DialogPortal from './dialog-portal.svelte';
import DialogOverlay from './dialog-overlay.svelte';
import DialogContent from './dialog-content.svelte';
import DialogTitle from './dialog-title.svelte';
import DialogDescription from './dialog-description.svelte';
import DialogClose from './dialog-close.svelte';

export {
	dialog,
	DialogHost as Dialog,
	DialogRoot as Root,
	DialogTrigger as Trigger,
	DialogPortal as Portal,
	DialogOverlay as Overlay,
	DialogContent as Content,
	DialogTitle as Title,
	DialogDescription as Description,
	DialogClose as Close
};
