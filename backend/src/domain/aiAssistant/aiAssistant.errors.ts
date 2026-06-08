const aiAssistantErrors = {
  disabled: { code: 'AI5030', message: 'AI assistant is unavailable' },
  invalidMessage: { code: 'AI4001', message: 'Message must be between 3 and 2000 characters' },
  invalidLocale: { code: 'AI4002', message: 'Locale must be "en" or "es"' },
  rateLimited: { code: 'AI4290', message: 'Rate limit exceeded. Please try again later.' },
  conversationNotFound: { code: 'AI4040', message: 'Conversation not found' },
};

export default aiAssistantErrors;
