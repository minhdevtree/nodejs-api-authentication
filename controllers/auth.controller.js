const createError = require('http-errors');
const User = require('../models/user.model');
const client = require('../helpers/init_redis');
const { registerSchema, loginSchema } = require('../helpers/validation_schema');
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
            const user = new User({ email, password });
            const savedUser = await user.save();

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
};
