const nodemailer = require('nodemailer');

const email = process.env.EMAIL_NAME;
const pass = process.env.EMAIL_PASSWORD;

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: email,
        pass,
    },
});

const mailOptions = {
    from: email,
    to: email,
};

module.exports = { transporter, mailOptions };
