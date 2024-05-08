const express = require('express');
const router = express.Router();
const createError = require('http-errors');
const User = require('../models/user.model');
const { registerSchema, loginSchema } = require('../helpers/validation_schema');

const {
    signAccessToken,
    signRefreshToken,
    verifyRefreshToken,
} = require('../helpers/jwt_helper');

router.post('/register', async (req, res, next) => {
    try {
        const { email, password } = registerSchema.parse(req.body);

        const isExist = await User.findOne({ email });
        if (isExist) {
            throw createError.Conflict(`${email} is already been registered`);
        }
        const user = new User({ email, password });
        const savedUser = await user.save();
        const accessToken = await signAccessToken(savedUser.id);
        const refreshToken = await signRefreshToken(savedUser.id);
        // const userObject = savedUser.toObject();
        // delete userObject.password;
        res.send({ accessToken, refreshToken });
    } catch (error) {
        if (error.errors) {
            const errors = Object.values(error.errors).map(err => err.message);
            error = createError(422, { message: errors.join(', ') });
        }
        next(error);
    }
});

router.post('/login', async (req, res, next) => {
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

        const accessToken = await signAccessToken(user.id);
        const refreshToken = await signRefreshToken(user.id);

        res.send({ accessToken, refreshToken });
    } catch (error) {
        if (error.errors) {
            const errors = Object.values(error.errors).map(err => err.message);
            error = createError(422, { message: errors.join(', ') });
        }
        next(error);
    }
});

router.post('/refresh-token', async (req, res, next) => {
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
});

router.delete('/logout', async (req, res, next) => {
    res.send('Logout route');
});

module.exports = router;
