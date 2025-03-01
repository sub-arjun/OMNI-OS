import { useEffect } from 'react';
import useNav from 'hooks/useNav';
import { Button, Tooltip } from '@fluentui/react-components';
import { Chat20Regular, Chat20Filled, Person20Regular, Bot20Regular } from '@fluentui/react-icons';
import useChatStore from 'stores/useChatStore';
import { IChat } from 'intellichat/types';
import Mousetrap from 'mousetrap';
import { findIndex } from 'lodash';

export default function ChatNav({ collapsed }: { collapsed: boolean }) {
  const chats = useChatStore((state) => state.chats);
  const currentChat = useChatStore((state) => state.chat);
  const fetchChat = useChatStore((state: any) => state.fetchChat);
  const navigate = useNav();

  useEffect(() => {
    Mousetrap.bind('mod+shift+up', () => {
      let index = 0;
      if (chats.length) {
        if (currentChat) {
          const curIdx = findIndex(
            chats,
            (item: IChat) => item.id === currentChat.id
          );
          index = Math.max(curIdx - 1, 0);
        }
        navigate(`/chats/${chats[index].id}`);
      }
    });
    Mousetrap.bind('mod+shift+down', () => {
      let index = 0;
      if (chats.length) {
        if (currentChat) {
          const curIdx = findIndex(
            chats,
            (item: IChat) => item.id === currentChat.id
          );
          index = Math.min(curIdx + 1, chats.length - 1);
        }
        navigate(`/chats/${chats[index].id}`);
      }
    });
    fetchChat();
    return () => {
      Mousetrap.unbind('mod+up');
      Mousetrap.unbind('mod+down');
    };
  }, [fetchChat,chats.length, currentChat?.id]);

  // Determine if a chat is from the user or agent based on summary content
  const isChatFromAgent = (summary: string | undefined) => {
    if (!summary) return false;
    // Check for common agent-initiated patterns
    return summary.toLowerCase().includes('assistant') || 
           summary.toLowerCase().includes('ai') ||
           summary.toLowerCase().includes('generated') ||
           summary.toLowerCase().includes('created');
  };

  const renderIconWithTooltip = (isActiveChat: boolean, chat: IChat) => {
    const isAgentChat = isChatFromAgent(chat.summary);
    return (
      <Tooltip
        withArrow
        content={chat.summary?.substring(0, 200)}
        relationship="label"
        positioning="above-start"
      >
        {isActiveChat ? 
          <Chat20Filled /> : 
          (isAgentChat ? <Bot20Regular /> : <Person20Regular />)
        }
      </Tooltip>
    );
  };

  return (
    <div className="h-full overflow-y-auto chat-list-container">
      <div
        className={`flex flex-col pt-2.5 ${collapsed ? 'content-center' : ''}`}
      >
        {chats.map((chat: IChat) => {
          const isActive = currentChat && currentChat.id === chat.id;
          const isAgentChat = isChatFromAgent(chat.summary);
          
          return (
            <div
              className={`px-2 my-1 ${collapsed ? 'mx-auto' : ''} ${
                isActive ? 'active' : ''
              }`}
              key={chat.id}
            >
              <Button
                icon={renderIconWithTooltip(isActive, chat)}
                appearance="subtle"
                className={`w-full justify-start latin hover:bg-black/10 dark:hover:bg-white/10 chat-item ${
                  isAgentChat ? 'agent-chat' : 'user-chat'
                }`}
                onClick={() => navigate(`/chats/${chat.id}`)}
              >
                {collapsed ? null : (
                  <div className="text-sm truncate ...">
                    {chat.summary?.substring(0, 40)}
                  </div>
                )}
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
