import type { AppContext } from './app.svelte';
import { Context } from 'runed';

export const appContext = new Context<AppContext>('<app-context />');
export const createApp = (app: AppContext): AppContext => appContext.set(app);
export const useApp = (): AppContext => appContext.get();
