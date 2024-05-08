const { z } = require('zod');

const registerSchema = z.object({
    email: z.string({ required_error: 'Email can not empty' }).email({
        message: 'Invalid email',
    }),
    password: z
        .string({
            required_error: 'Password can not empty',
        })
        .min(6, { message: 'Password must be at least 6 characters' }),
});

const loginSchema = z.object({
    email: z
        .string({
            required_error: 'Email can not empty',
        })
        .email({
            message: 'Invalid email',
        }),
    password: z
        .string({
            required_error: 'Password can not empty',
        })
        .min(6, { message: 'Password must be at least 6 characters' }),
});

module.exports = { registerSchema, loginSchema };
