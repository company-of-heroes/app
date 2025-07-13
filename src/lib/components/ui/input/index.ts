import type { HTMLInputAttributes } from 'svelte/elements';
import Input from './input.svelte';
import Checkbox from './checkbox.svelte';
import RadioGroup from './radio-group.svelte';
import Select from './select.svelte';
import Options from './options.svelte';

export type InputProps = {} & HTMLInputAttributes;

export { Input, Checkbox, RadioGroup, Select, Options };
