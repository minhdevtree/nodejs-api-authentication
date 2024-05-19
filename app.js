const express = require('express');
const morgan = require('morgan');
const createError = require('http-errors');
const { verifyAccessToken } = require('./helpers/jwt_helper');
const os = require('os');

require('dotenv').config();
require('./helpers/init_mongodb');

const app = express();
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const computerName = os.hostname();
const platform = os.platform();
console.log('Computer Name:', computerName);
console.log('Platform:', platform);

// Demo data
const users = [
    { id: 1, name: 'Alex' },
    { id: 2, name: 'Max' },
    { id: 3, name: 'Hagard' },
];

app.get('/', verifyAccessToken, async (req, res, next) => {
    res.send('Hello from express');
});

app.get('/users', verifyAccessToken, async (req, res, next) => {
    res.send(users);
});

const authRoute = require('./routes/auth.route');

app.use('/auth', authRoute);

app.use(async (req, res, next) => {
    next(createError.NotFound());
});

app.use((err, req, res, next) => {
    res.status(err.status || 500);
    res.send({
        error: {
            status: err.status || 500,
            message: err.message,
        },
    });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
