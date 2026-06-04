import responsesService from '@services/responses/responses.service';

const registrationResponses = {
  registerOk: responsesService.createInternalResponse(200, 'REG2001', 'Registration successful. Please check your email to verify your account'),
  verifyEmailOk: responsesService.createInternalResponse(200, 'REG2002', 'Email verified successfully'),
  resendVerificationOk: responsesService.createInternalResponse(200, 'REG2003', 'If the email is registered and unverified, a new verification link has been sent'),
  badRequest: (statusCode: number, message: string) => {
    return responsesService.createInternalResponse(statusCode, 'REG4001', message);
  },
};

export default registrationResponses;
