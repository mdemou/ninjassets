import responsesService from '@services/responses/responses.service';

const avatarResponses = {
  uploadOk: responsesService.createInternalResponse(200, 'AVT2001', 'Avatar updated successfully'),
  removeOk: responsesService.createInternalResponse(200, 'AVT2002', 'Avatar removed successfully'),
  badRequest: (statusCode: number, message: string) => {
    return responsesService.createInternalResponse(statusCode, 'AVT4001', message);
  },
  forbidden: responsesService.createInternalResponse(403, 'AVT4031', 'Not allowed to view this avatar'),
  notFound: responsesService.createInternalResponse(404, 'AVT4041', 'Avatar not found'),
};

export default avatarResponses;
