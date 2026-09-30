import { type UserContext, createUser, useUser } from './user.context.svelte';
import User from './user.svelte';
import UserAvatar from './user-avatar.svelte';
import UserImage from './user-image.svelte';
import UserName from './user-name.svelte';
import UserLabels from './user-labels.svelte';

export {
	type UserContext,
	createUser,
	useUser,
	User as Root,
	UserAvatar as Avatar,
	UserImage as Image,
	UserName as Name,
	UserLabels as Labels
};
export type { UserAvatarRecord } from './user-avatar-src';
