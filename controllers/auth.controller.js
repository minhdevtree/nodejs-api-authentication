const createError = require('http-errors');
const User = require('../models/user.model');
const client = require('../helpers/init_redis');
const { registerSchema, loginSchema } = require('../helpers/validation_schema');
const welcomeTemplate = require('../templates/welcome');
const handlebars = require('handlebars');
const { transporter } = require('../helpers/init_nodemailer');
const { randomUUID } = require('crypto');
const bcrypt = require('bcrypt');
const os = require('os');

const {
    signAccessToken,
    signRefreshToken,
    verifyRefreshToken,
} = require('../helpers/jwt_helper');

module.exports = {
    register: async (req, res, next) => {
        try {
            const { email, password } = registerSchema.parse(req.body);

            const isExist = await User.findOne({ email });
            if (isExist) {
                throw createError.Conflict(
                    `${email} is already been registered`
                );
            }
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(password, salt);

            const user = new User({ email, password: hashedPassword });
            const savedUser = await user.save();

            const activationToken = `${randomUUID()}${randomUUID()}`.replace(
                /-/g,
                ''
            );
            await client.set(
                `emailActivationToken-${activationToken}`,
                user.id,
                'EX',
                900
            );

            const template = handlebars.compile(welcomeTemplate);
            const htmlToSend = template({
                email: user.email,
                siteConfigName: process.env.FRONTEND_SITE_NAME,
                activeLink: `${process.env.BACKEND_URL}/auth/activate/${activationToken}?active=EMAIL_VERIFY`,
            });

            const mailOptions = {
                from: process.env.EMAIL_NAME,
                to: user.email,
                subject: `Activate your account ${process.env.FRONTEND_SITE_NAME}`,
                text: `Welcome ${user.email} to ${process.env.FRONTEND_SITE_NAME}. Link to active your account: ${process.env.BACKEND_URL}/auth/activate/${activationToken}?active=EMAIL_VERIFY`,
                html: htmlToSend,
            };

            await transporter.sendMail(mailOptions);

            const userObject = savedUser.toObject();
            delete userObject.password;
            res.send(userObject);
        } catch (error) {
            if (error.errors) {
                const errors = Object.values(error.errors).map(
                    err => err.message
                );
                error = createError(422, { message: errors.join(', ') });
            }
            next(error);
        }
    },
    login: async (req, res, next) => {
        try {
            const { email, password } = loginSchema.parse(req.body);
            const user = await User.findOne({ email });
            if (!user) {
                throw createError.NotFound('User not registered');
            }
            const isMatch = await user.isValidPassword(password);
            if (!isMatch) {
                throw createError.Unauthorized('Username/password not valid');
            }

            if (user.status === 'NOT_ACTIVE')
                throw createError.Unauthorized('User not activated');
            if (user.status === 'BANNED')
                throw createError.Unauthorized('User is banned');
            if (user.status === 'DELETED')
                throw createError.Unauthorized('User is deleted');

            const accessToken = await signAccessToken(user);
            const refreshToken = await signRefreshToken(user.id);

            res.send({ accessToken, refreshToken });
        } catch (error) {
            if (error.errors) {
                const errors = Object.values(error.errors).map(
                    err => err.message
                );
                error = createError(422, { message: errors.join(', ') });
            }
            next(error);
        }
    },
    refreshToken: async (req, res, next) => {
        try {
            const { refreshToken } = req.body;
            if (!refreshToken) throw createError.BadRequest();
            const userId = await verifyRefreshToken(refreshToken);

            const user = await User.findById(userId);

            const accessToken = await signAccessToken(user);
            const refToken = await signRefreshToken(userId);

            res.send({ accessToken: accessToken, refreshToken: refToken });
        } catch (error) {
            next(error);
        }
    },
    logout: async (req, res, next) => {
        try {
            const { refreshToken } = req.body;
            if (!refreshToken) throw createError.BadRequest();
            const userId = await verifyRefreshToken(refreshToken);

            await client.del(
                `refreshToken-${os.hostname()}-${os.platform()}-${userId}`
            );
            res.sendStatus(204);
        } catch (error) {
            console.log(error.message);
            next(error);
        }
    },
    logoutAll: async (req, res, next) => {
        try {
            const { refreshToken } = req.body;
            if (!refreshToken) throw createError.BadRequest();
            const userId = await verifyRefreshToken(refreshToken);

            const keys = await client.keys(`refreshToken-*-${userId}`);
            keys.forEach(async key => {
                await client.del(key);
            });
            res.sendStatus(204);
        } catch (error) {
            next(error);
        }
    },
    activate: async (req, res, next) => {
        try {
            const { token } = req.params;
            const { active } = req.query;

            if (!token) throw createError.BadRequest();

            const userId = await client.get(`emailActivationToken-${token}`);
            if (!userId) throw createError.BadRequest();

            const user = await User.findById(userId);
            if (!user) throw createError.BadRequest();

            if (active === 'EMAIL_VERIFY') {
                user.status = 'ACTIVE';
                await user.save();
                await client.del(`emailActivationToken-${token}`);
            }

            res.send({ message: 'Account activated successfully' });
        } catch (error) {
            next(error);
        }
    },
};
