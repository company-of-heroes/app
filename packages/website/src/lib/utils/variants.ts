import { cn } from './cn';

export * from '@company-of-heroes/ui/variants';

export const pageShell = cn(
	'border-secondary-800 relative mx-auto flex min-h-screen max-w-6xl flex-col border-x bg-gray-950'
);

export const headerCellAction = cn(
	'bg-primary/5 h-full self-stretch rounded-none border-0 shadow-none ring-0 outline-none',
	'hover:bg-primary/20 focus-visible:ring-0 focus-visible:outline-none'
);

export const headerCellActionPrimary = cn(
	'bg-primary text-secondary-950 h-full self-stretch rounded-none border-0 shadow-none ring-0 outline-none',
	'hover:bg-primary/90 focus-visible:ring-0 focus-visible:outline-none'
);

export const surfaceModal = cn('border-secondary-800 rounded-lg border bg-gray-950 shadow-lg');
