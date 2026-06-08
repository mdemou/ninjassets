import responsesService from '@services/responses/responses.service';

const aiResponses = {
  chatOk: responsesService.createInternalResponse(200, 'AI2000', 'Streaming RAG response (SSE)'),
  conversationsOk: responsesService.createInternalResponse(200, 'AI2001', 'Conversations retrieved successfully'),
  conversationOk: responsesService.createInternalResponse(200, 'AI2002', 'Conversation retrieved successfully'),
  deleteOk: responsesService.createInternalResponse(200, 'AI2003', 'Conversation deleted successfully'),
  badRequest: (statusCode: number, message: string) => {
    return responsesService.createInternalResponse(statusCode, 'AI4001', message);
  },
};

export default aiResponses;
