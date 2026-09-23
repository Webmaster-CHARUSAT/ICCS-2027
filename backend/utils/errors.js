class AppError extends Error {
  constructor(statusCode, code, message) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

class ValidationError extends AppError {
  constructor(message) {
    super(400, 'VALIDATION_ERROR', message);
  }
}

class UnauthorizedError extends AppError {
  constructor(message) {
    super(401, 'UNAUTHORIZED', message || 'Authentication required.');
  }
}

class ForbiddenError extends AppError {
  constructor(message) {
    super(403, 'FORBIDDEN', message || 'You do not have permission to perform this action.');
  }
}

class NotFoundError extends AppError {
  constructor(message) {
    super(404, 'NOT_FOUND', message || 'Resource not found.');
  }
}

class ConflictError extends AppError {
  constructor(message) {
    super(409, 'CONFLICT', message || 'Resource already exists.');
  }
}

class ServiceUnavailableError extends AppError {
  constructor(message) {
    super(503, 'SERVICE_UNAVAILABLE', message || 'A required upstream service is unavailable.');
  }
}

// Registration → abstract-submission gating (see controllers/abstractController.js).
class AlreadyRegisteredError extends AppError {
  constructor(message) {
    super(409, 'ALREADY_REGISTERED', message || 'You are already registered using this email address or phone number.');
  }
}

class RegistrationRequiredError extends AppError {
  constructor(message) {
    super(400, 'REGISTRATION_REQUIRED', message || 'Please complete conference registration before submitting an abstract.');
  }
}

class RegistrationNotFoundError extends AppError {
  constructor(message) {
    super(404, 'REGISTRATION_NOT_FOUND', message || 'We could not verify your conference registration. Please register first or contact the conference organizers.');
  }
}

class RegistrationInvalidError extends AppError {
  constructor(message) {
    super(403, 'REGISTRATION_INVALID', message || 'Your conference registration could not be used for this submission.');
  }
}

class AbstractAlreadySubmittedError extends AppError {
  constructor(message) {
    super(409, 'ABSTRACT_ALREADY_SUBMITTED', message || 'An abstract has already been submitted for this registration.');
  }
}

module.exports = {
  AppError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  ServiceUnavailableError,
  AlreadyRegisteredError,
  RegistrationRequiredError,
  RegistrationNotFoundError,
  RegistrationInvalidError,
  AbstractAlreadySubmittedError
};
