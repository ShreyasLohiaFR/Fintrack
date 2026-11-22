const errorHandler = (err, req, res, next) => {
  if (process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test') {
    console.error(err);
  }

  let statusCode = err.statusCode || 500;
  let message = err.message || 'Server error';

  if (err.name === 'CastError') {
    statusCode = 404;
    message = 'Resource not found';
  }

  if (err.code === 11000) {
    statusCode = 400;
    message = 'That value is already in use';
  }

  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = Object.values(err.errors).map((validationError) => validationError.message).join(', ');
  }

  res.status(statusCode).json({
    success: false,
    message: statusCode === 500 ? 'Something went wrong. Please try again.' : message
  });
};

module.exports = errorHandler;
