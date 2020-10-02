const ErrorResponse = require('../utils/errorResponse');
const asyncHandler = require('../middleware/async');
const sendEmail = require('../utils/sendEmail');
const User = require('../models/User');

// desc>> register user
//route POST api/v1/auth/register
//access Public
exports.register = asyncHandler(async (req, res, next) => {
  const { name, email, password, role } = req.body;

  //create user
  const user = await User.create({
    name,
    email,
    password,
    role,
  });

  //CCREATE TOKEN
  sendTokenResponse(user, 200, res);
});

// desc>> login user
//route POST api/v1/auth/login
//access Public
exports.login = asyncHandler(async (req, res, next) => {
  const { email, password } = req.body;

  //validate email and password
  if (!email || !password) {
    return next(
      new ErrorResponse('please provide and email and password', 400)
    );
  }

  //check for user
  const user = await User.findOne({ email }).select('+password');

  if (!user) {
    return next(new ErrorResponse('invalid credentials', 401));
  }

  //check if password matches
  const isMatch = await user.matchPassword(password);

  if (!isMatch) {
    return next(new ErrorResponse('invalid credentials', 401));
  }

  sendTokenResponse(user, 200, res);
});

// desc>> get logged in user
//route POST api/v1/auth/me
//access Private
exports.getMe = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user.id);

  res.status(200).json({ success: true, data: user });
});

// desc>> forgot password
//route POST api/v1/auth/forgotpassword
//access Public
exports.forgotPassword = asyncHandler(async (req, res, next) => {
  const user = await User.findOne({ email: req.body.email });

  if (!user) {
    return next(new ErrorResponse('there is no user with that email', 404));
  }

  //get reset token
  const resetToken = user.getResetPasswordToken();
  await user.save({ validateBeforeSave: false });

  //create reset url
  const resetUrl = `${req.protocol}://${req.get(
    'host'
  )}/api/v1/resetpassword/${resetToken}`;

  const message = `you are receiving this email because you, or someone else, has requested a password reset. Please make a PUT request to: \n\n ${resetUrl}`;

  try {
    await sendEmail({
      email: user.email,
      subject: 'Passowrd reset token',
      message,
    });
    res.status(200).json({ success: true, data: 'email sent' });
  } catch (err) {
    console.log(err);
    user.rsetPasswordToken = undefined;
    user.rsetPasswordExpire = undefined;

    await user.save({ validateBeforeSave: false });

    return next(new ErrorResponse('email could not be sent', 500));
  }
  res.status(200).json({ success: true, data: user });
});

//get token from model, create cookie and send response
const sendTokenResponse = (user, statusCode, res) => {
  //create token
  const token = user.getSignedJwtToken();

  const options = {
    expires: new Date(
      Date.now() + process.env.JWT_COOKIE_EXPIRE * 24 * 60 * 60 * 1000
    ),
    httpOnly: true,
  };

  if (process.env.NODE_ENV === 'production') {
    options.secure = true;
  }

  res
    .status(statusCode)
    .cookie('token', token, options)
    .json({ success: true, token });
};
