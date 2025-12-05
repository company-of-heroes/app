import type { TypedPocketBase } from './types';
import Pocketbase from 'pocketbase';

export const pocketbase = new Pocketbase('https://api.fknoobs.com') as TypedPocketBase;
