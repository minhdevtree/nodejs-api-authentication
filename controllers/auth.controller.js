const createError = require('http-errors');
const User = require('../models/user.model');
const client = require('../helpers/init_redis');
const { registerSchema, loginSchema } = require('../helpers/validation_schema');

const {
    signAccessToken,
    signRefreshToken,
    verifyRefreshToken,
    deleteRefreshToken,
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
            console.log(user.id);
            const accessToken = await signAccessToken(user.id);
            console.log('acc', accessToken);
            const refreshToken = await signRefreshToken(user.id);
            console.log('ref', refreshToken);
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

            const accessToken = await signAccessToken(userId);
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

            await client.del(`refreshToken-${userId}`);
            res.sendStatus(204);
        } catch (error) {
            next(error);
        }
    },
};
