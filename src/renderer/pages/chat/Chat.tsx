import React from 'react';
import useChatStore from 'stores/useChatStore';
import { IChatMessage } from 'intellichat/types';
import Messages from './Messages';
import InputBar from './InputBar';

export default function Chat() {
  const messages = useChatStore((state) => state.messages);
  const { getCurState } = useChatStore();
  const loading = getCurState().loading;

  return (
    <div className="flex flex-col h-full">
      <Messages messages={messages} />
      <InputBar onSubmit={(text) => {
        // Create a new message directly
        const chatStore = useChatStore.getState();
        // Check if the store has necessary methods before calling
        if (chatStore && typeof chatStore.createMessage === 'function') {
          // Create a user message with the input text
          chatStore.createMessage({
            chatId: chatStore.chat.id,
            prompt: text,
            reply: '',
            model: chatStore.chat.model || '',
            temperature: chatStore.chat.temperature || 0,
            maxTokens: chatStore.chat.maxTokens || null,
            inputTokens: 0,
            outputTokens: 0,
            isActive: true,
            createdAt: Date.now()
          });
        }
      }} isLoading={loading} />
    </div>
  );
} 