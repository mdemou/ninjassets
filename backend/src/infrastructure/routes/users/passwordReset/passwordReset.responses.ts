import responsesService from '@services/responses/responses.service';

const passwordResetResponses = {
  forgotPasswordOk: responsesService.createInternalResponse(200, 'PWR2001', 'If an account with that email exists, a password reset link has been sent'),
  resetPasswordOk: responsesService.createInternalResponse(200, 'PWR2002', 'Password has been reset successfully'),
  badRequest: (statusCode: number, message: string) => {
    return responsesService.createInternalResponse(statusCode, 'PWR4001', message);
  },
};

export default passwordResetResponses;
