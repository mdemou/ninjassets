import responsesService from '@services/responses/responses.service';

const usersResponses = {
  listUsersOk: responsesService.createInternalResponse(200, 'USR2001', 'Users retrieved successfully'),
  getUserOk: responsesService.createInternalResponse(200, 'USR2002', 'User details retrieved successfully'),
  createUserOk: responsesService.createInternalResponse(
    200,
    'CRU2001',
    'User created. An activation email has been sent',
  ),
  updateUserOk: responsesService.createInternalResponse(200, 'USR2003', 'User updated successfully'),
  deleteUserOk: responsesService.createInternalResponse(200, 'USR2004', 'User deleted successfully'),
  changePasswordOk: responsesService.createInternalResponse(200, 'USR2005', 'Password changed successfully'),
  badRequest: (statusCode: number, message: string) => {
    return responsesService.createInternalResponse(statusCode, 'USR4001', message);
  },
};

export default usersResponses;
