const express = require('express');
const router = express.Router();

const {
    register,
    login,
    refreshToken,
    logout,
    logoutAll,
    activate,
} = require('../controllers/auth.controller');

router.post('/register', register);

router.post('/login', login);

router.post('/refresh-token', refreshToken);

router.delete('/logout', logout);

router.delete('/logout-all', logoutAll);

router.get('/activate/:token', activate);

module.exports = router;
