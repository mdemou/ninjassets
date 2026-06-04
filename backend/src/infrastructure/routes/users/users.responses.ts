import responsesService from '@services/responses/responses.service';

const usersResponses = {
  changePasswordOk: responsesService.createInternalResponse(200, 'USR2001', 'Password changed successfully'),
  updateProfileOk: responsesService.createInternalResponse(200, 'USR2002', 'Profile updated successfully'),
  deleteAccountOk: responsesService.createInternalResponse(200, 'USR2003', 'Account deleted successfully'),
  badRequest: (statusCode: number, message: string) => {
    return responsesService.createInternalResponse(statusCode, 'USR4001', message);
  },
};

export default usersResponses;
