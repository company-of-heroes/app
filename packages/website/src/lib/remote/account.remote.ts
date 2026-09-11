import { form, getRequestEvent } from '$app/server';
import { error, invalid, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import { canRequestEmailChange, isPlaceholderEmail } from '@company-of-heroes/api';
import { syncLocalsUser } from '$lib/hooks/boot';

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

const updateProfileSchema = z.object({
	name: z.string().trim().max(100).optional().default(''),
	avatar: z
		.instanceof(File)
		.optional()
		.refine((file) => !file || file.size === 0 || file.size <= MAX_AVATAR_BYTES, {
			message: 'Avatar must be 2 MB or smaller.'
		})
		.refine(
			(file) =>
				!file ||
				file.size === 0 ||
				['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp', 'image/bmp'].includes(
					file.type
				),
			{ message: 'Avatar must be an image file.' }
		)
});

export const updateProfile = form(updateProfileSchema, async (data) => {
	const event = getRequestEvent();
	const { locals } = event;
	if (!locals.user) {
		error(401, locals.t('Log in to do that.'));
	}

	const avatar =
		data.avatar && data.avatar.size > 0
			? new File([data.avatar], data.avatar.name || 'avatar.png', {
					type: data.avatar.type || 'image/png'
				})
			: undefined;

	const result = await locals.services.auth().updateProfile({
		name: data.name,
		avatar
	});
	if (result.isErr()) {
		invalid(locals.t(result.error.message));
	}

	syncLocalsUser(event);
	redirect(303, '/account?saved=profile');
});

const updatePasswordSchema = z.object({
	oldPassword: z.string().min(1, 'Current password is required.'),
	password: z.string().min(8, 'Password must be at least 8 characters.'),
	passwordConfirm: z.string().min(1)
});

export const updatePassword = form(updatePasswordSchema, async (data) => {
	const event = getRequestEvent();
	const { locals } = event;
	if (!locals.user) {
		error(401, locals.t('Log in to do that.'));
	}

	if (data.password !== data.passwordConfirm) {
		invalid(locals.t('Passwords do not match.'));
	}

	const result = await locals.services.auth().updatePassword({
		oldPassword: data.oldPassword,
		password: data.password
	});
	if (result.isErr()) {
		invalid(locals.t(result.error.message));
	}

	syncLocalsUser(event);
	redirect(303, '/account?saved=password');
});

const requestVerificationSchema = z.object({
	email: z.string().trim().email('Enter a valid email address.')
});

export const requestVerification = form(requestVerificationSchema, async (data) => {
	const { locals } = getRequestEvent();
	if (!locals.user) {
		error(401, locals.t('Log in to do that.'));
	}

	if (isPlaceholderEmail(data.email)) {
		invalid(locals.t('Set a real email address before verifying.'));
	}

	const result = await locals.services.auth().requestVerification(data.email);
	if (result.isErr()) {
		invalid(locals.t(result.error.message));
	}

	redirect(303, '/account?sent=verification');
});

const requestEmailChangeSchema = z.object({
	newEmail: z.string().trim().email('Enter a valid email address.')
});

export const requestEmailChange = form(requestEmailChangeSchema, async (data) => {
	const { locals } = getRequestEvent();
	if (!locals.user) {
		error(401, locals.t('Log in to do that.'));
	}

	if (!canRequestEmailChange(locals.user)) {
		invalid(locals.t('Verify your email before changing it.'));
	}

	const result = await locals.services.auth().requestEmailChange(data.newEmail);
	if (result.isErr()) {
		invalid(locals.t(result.error.message));
	}

	redirect(303, '/account?sent=email-change');
});

const confirmEmailChangeSchema = z.object({
	token: z.string().trim().min(1, 'Invalid or expired email change link.'),
	password: z.string().min(1, 'Password is required.')
});

export const confirmEmailChange = form(confirmEmailChangeSchema, async (data) => {
	const event = getRequestEvent();
	const { locals } = event;

	const result = await locals.services.auth().confirmEmailChange(data.token, data.password);
	if (result.isErr()) {
		invalid(locals.t(result.error.message));
	}

	syncLocalsUser(event);
	redirect(303, '/account?saved=email');
});
