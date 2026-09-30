import { parseReplay } from '@fknoobs/replay-parser';
import { Context } from 'runed';
import { flattenReplay, type FlatReplay } from '@company-of-heroes/ui/replay/parse';

const context = new Context<FlatReplay>('<replay />');
export const createReplay = (file: () => ArrayBuffer | Uint8Array) =>
	context.set(flattenReplay(parseReplay(file())));
export const useReplay = () => context.get();
