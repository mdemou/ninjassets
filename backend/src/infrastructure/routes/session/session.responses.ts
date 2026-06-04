import responsesService from '@services/responses/responses.service';

const sessionResponses = {
  loginOk: responsesService.createInternalResponse(200, 'AUTH2001', 'Login successful'),
  logoutOk: responsesService.createInternalResponse(200, 'AUTH2002', 'Logout successful'),
  meOk: responsesService.createInternalResponse(200, 'AUTH2003', 'Current user retrieved'),
  publicConfigOk: responsesService.createInternalResponse(200, 'AUTH2004', 'Public configuration'),
  badRequest: (statusCode: number, message: string) => {
    return responsesService.createInternalResponse(statusCode, 'AUTH4001', message);
  },
};

export default sessionResponses;
