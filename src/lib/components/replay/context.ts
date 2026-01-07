import { parseReplay, type ReplayData } from '@fknoobs/replay-parser';
import { Context } from 'runed';

const context = new Context<ReplayData>('<replay />');
export const createReplay = (file: () => ArrayBuffer | Uint8Array) =>
	context.set(parseReplay(file()));
export const useReplay = () => context.get();
