import Debug from 'debug';
import { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { debounce } from 'lodash';
import { useTranslation } from 'react-i18next';
import SplitPane, { Pane } from 'split-pane-react';
import useChatStore from 'stores/useChatStore';
import useToast from 'hooks/useToast';
import useChatService from 'hooks/useChatService';
import useToken from 'hooks/useToken';
import Empty from 'renderer/components/Empty';
import { tempChatId } from 'consts';
import useUsageStore from 'stores/useUsageStore';
import useNav from 'hooks/useNav';
import Header from './Header';
import Messages from './Messages';
import Editor from './Editor';

import './Chat.scss';
import 'split-pane-react/esm/themes/default.css';
import { IChat, IChatResponseMessage } from 'intellichat/types';
import { isBlank } from 'utils/validators';
import useChatKnowledgeStore from 'stores/useChatKnowledgeStore';
import useKnowledgeStore from 'stores/useKnowledgeStore';
import CitationDialog from './CitationDialog';
import { ICollectionFile } from 'types/knowledge';
import {
  extractCitationIds,
  getNormalContent,
  getReasoningContent,
} from 'utils/util';
import INextChatService from 'intellichat/services/INextCharService';
import useSettingsStore from 'stores/useSettingsStore';
import Sidebar from './Sidebar/Sidebar';
import useInspectorStore from 'stores/useInspectorStore';
import React from 'react';

const debug = Debug('OMNI-OS:pages:chat');

const MemoizedMessages = React.memo(Messages);

export default function Chat() {
  const { t } = useTranslation();
  const id = useParams().id || tempChatId;
  const anchor = useParams().anchor || null;

  const [activeChatId, setActiveChatId] = useState(id);
  if (activeChatId !== id) {
    setActiveChatId(id);
    debug('Set chat id:', id);
  }
  const [sizes, setSizes] = useState(['auto', 200]);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNav();

  const keywords = useChatStore((state) => state.keywords);
  const messages = useChatStore((state) => state.messages);
  const setKeyword = useChatStore((state) => state.setKeyword);
  const fetchMessages = useChatStore((state) => state.fetchMessages);
  const initChat = useChatStore((state) => state.initChat);
  const getChat = useChatStore((state) => state.getChat);
  const updateChat = useChatStore((state) => state.updateChat);
  const updateStates = useChatStore((state) => state.updateStates);
  const clearTrace = useInspectorStore((state) => state.clearTrace);
  const modelMapping = useSettingsStore((state) => state.modelMapping);
  const [chatService] = useState<INextChatService>(useChatService());

  const { notifyError } = useToast();

  const isUserScrollingRef = useRef(false);
  const lastScrollTopRef = useRef(0);

  const scrollToBottom = useRef(
    debounce(
      () => {
        if (ref.current) {
          ref.current.scrollTop = ref.current.scrollHeight;
        }
      },
      100,
      { leading: true, maxWait: 300 },
    ),
  ).current;

  // 监听滚动事件
  const handleScroll = useRef(
    debounce(
      () => {
        if (ref.current) {
          const { scrollTop, scrollHeight, clientHeight } = ref.current;
          const atBottom = scrollTop + clientHeight >= scrollHeight - 50;
          if (scrollTop > lastScrollTopRef.current) {
            if (atBottom) {
              isUserScrollingRef.current = false;
            }
          } else {
            isUserScrollingRef.current = true;
            scrollToBottom.cancel();
          }
          lastScrollTopRef.current = scrollTop;
        }
      },
      300,
      { leading: true, maxWait: 500 },
    ),
  ).current;

  useEffect(() => {
    const currentRef = ref.current;
    currentRef?.addEventListener('scroll', handleScroll);
    return () => {
      currentRef?.removeEventListener('scroll', handleScroll);
      isUserScrollingRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (activeChatId !== tempChatId) {
      getChat(activeChatId);
    } else if (chatService?.isReady()) {
      initChat({});
    }
    return () => {
      isUserScrollingRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeChatId]);

  const debouncedFetchMessages = useMemo(
    () =>
      debounce(
        async (chatId: string, keyword: string) => {
          await fetchMessages({ chatId, keyword });
          debug('Fetch chat messages, chatId:', chatId, ', keyword:', keyword);
        },
        400,
        {
          leading: true,
          maxWait: 2000,
        },
      ),
    [fetchMessages],
  );

  useEffect(() => {
    const loadMessages = async () => {
      const keyword = keywords[activeChatId] || '';
      await debouncedFetchMessages(activeChatId, keyword);
      if (anchor) {
        const anchorDom = document.getElementById(anchor);
        anchorDom?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      } else {
        scrollToBottom();
      }
    };
    loadMessages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeChatId, debouncedFetchMessages, keywords]);

  const sashRender = () => <div className="border-t border-base" />;

  const createMessage = useChatStore((state) => state.createMessage);
  const createChat = useChatStore((state) => state.createChat);
  const deleteStage = useChatStore((state) => state.deleteStage);
  const { countInput, countOutput } = useToken();
  const updateMessage = useChatStore((state) => state.updateMessage);
  const appendReply = useChatStore((state) => state.appendReply);

  const { moveChatCollections, listChatCollections, setChatCollections } =
    useChatKnowledgeStore.getState();

  const onSubmit = useCallback(
    async (prompt: string) => {
      if (prompt.trim() === '') {
        return;
      }
      const model = chatService.context.getModel();
      let $chatId = activeChatId;
      if (activeChatId === tempChatId) {
        const $chat = await createChat(
          {
            summary: prompt.substring(0, 50),
          },
          async (newChat: IChat) => {
            const knowledgeCollections = moveChatCollections(
              tempChatId,
              newChat.id,
            );
            await setChatCollections(newChat.id, knowledgeCollections);
          },
        );
        $chatId = $chat.id;
        setActiveChatId($chatId);
        navigate(`/chats/${$chatId}`);
        deleteStage(tempChatId);
      } else {
        await updateChat({
          id: activeChatId,
          summary: prompt.substring(0, 50),
        });
        setKeyword(activeChatId, ''); // clear filter keyword
      }
      clearTrace($chatId);
      updateStates($chatId, { loading: true });

      const msg = await useChatStore.getState().createMessage({
        prompt,
        reply: '',
        chatId: $chatId,
        model: modelMapping[model.label || ''] || model.label,
        temperature: chatService.context.getTemperature(),
        maxTokens: chatService.context.getMaxTokens(),
        isActive: 1,
      });

      scrollToBottom();

      // Knowledge Collections
      let knowledgeChunks = [];
      let files: ICollectionFile[] = [];
      let actualPrompt = prompt;
      const chatCollections = await listChatCollections($chatId);
      
      if (chatCollections.length) {
        debug(`Chat ${$chatId} has ${chatCollections.length} knowledge collections attached`);
        
        // Log whether any OMNIBase collections are included
        const omnibaseCollections = chatCollections.filter(c => 
          c.type === 'omnibase' || (c.id && c.id.toString().startsWith('omnibase:'))
        );
        
        if (omnibaseCollections.length > 0) {
          debug(`Chat includes ${omnibaseCollections.length} OMNIBase collections: ${
            omnibaseCollections.map(c => c.name).join(', ')
          }`);
        }
        
        debug(`Searching knowledge collections for: "${prompt.substring(0, 100)}${prompt.length > 100 ? '...' : ''}"`);
        
        const knowledgeString = await window.electron.knowledge.search(
          chatCollections.map((c) => c.id),
          prompt,
        );
        
        knowledgeChunks = JSON.parse(knowledgeString);
        debug(`Knowledge search returned ${knowledgeChunks.length} chunks`);
        useKnowledgeStore.getState().cacheChunks(knowledgeChunks);
        
        // Check if there are actual chunks to include
        if (knowledgeChunks && knowledgeChunks.length > 0) {
          const filesId = [
            ...new Set<string>(knowledgeChunks.map((k: any) => k.fileId)),
          ];
          
          // For OMNIBase chunks, the fileId might be 'omnibase-external'
          const localFileIds = filesId.filter(id => id !== 'omnibase-external');
          
          if (localFileIds.length > 0) {
            files = await useKnowledgeStore.getState().getFiles(localFileIds);
            debug(`Retrieved ${files.length} file references`);
          }
          
          // Format knowledge chunks for prompt
          const formattedChunks = knowledgeChunks.map((k: any, idx: number) => {
            // For OMNIBase entries, the fileId might be 'external'
            const isOmnibase = k.fileId === 'omnibase-external' || (k.collectionId && k.collectionId.toString().startsWith('omnibase:'));
            
            // For OMNIBase entries, use a default name
            const file = files.find((f) => f.id === k.fileId);
            const fileName = file?.name || (isOmnibase ? 'OMNIBase' : 'Unknown Source');
            
            // Make sure content is never empty
            let content = k.content || '';
            if (!content.trim()) {
              debug(`Warning: Empty content for knowledge chunk ${idx + 1}`);
              content = `[No content available for chunk ${idx + 1}]`;
            }
            
            // Log the content for debugging
            debug(`Chunk ${idx + 1} content: ${content.substring(0, 100)}${content.length > 100 ? '...' : ''}`);
            
            return {
              seqNo: idx + 1,
              file: fileName,
              id: k.id,
              content: content,
            };
          });
          
          debug(`Formatted ${formattedChunks.length} knowledge chunks for RAG`);
          
          actualPrompt = `
# Context #
Please read carefully and use the following context information in JSON format to answer questions.
The context format is {"seqNo": number, "id": "id", "file":"fileName", "content": "content"}.
When using context information in your response, output the reference as \`[(<seqNo>)](citation#<id> '<file>')\` strictly after the relevant content.
---------------------------------------------------
For example:
the context information is: {"seqNo": 1, "id": "432939KFD83242", "file":"Fruit Encyclopedia", "content": "apples are one of common fruit"}.
and the question is: "What are some common fruits?".
The answer should be:
"According to the information provided, apples are a common fruit [(1)](citation#432939KFD83242 'Fruit Encyclopedia')."
---------------------------------------------------
Ensure that the context information is accurately referenced, and label it as [(<seqNo>)](citation#<id> '<file>') when a piece of information is actually used.
${JSON.stringify(formattedChunks)}

# Objective #
${prompt}
`;
        }
      }

      const onChatComplete = async (result: IChatResponseMessage) => {
        /**
         * 异常分两种情况，一种是有输出， 但没有正常结束； 一种是没有输出
         * 异常且没有输出，则只更新 isActive 为 0
         */
        if (
          result.error &&
          isBlank(result.content) &&
          isBlank(result.reasoning)
        ) {
          await updateMessage({
            id: msg.id,
            isActive: 0,
          });
        } else {
          const inputTokens = result.inputTokens || (await countInput(prompt));
          const outputTokens =
            result.outputTokens || (await countOutput(result.content || ''));
          const citedChunkIds = extractCitationIds(result.content || '');
          const citedChunks = knowledgeChunks.filter((k: any) =>
            citedChunkIds.includes(k.id),
          );
          const citedFileIds = [
            ...new Set(citedChunks.map((k: any) => k.fileId)),
          ];
          const citedFiles = files.filter((f) => citedFileIds.includes(f.id));
          
          // Debug citations from the result
          if (result.citations) {
            console.log('Citations received in onChatComplete:', result.citations);
            console.log('Citations type:', typeof result.citations);
            console.log('Citations is array:', Array.isArray(result.citations));
            console.log('Citations length:', result.citations.length);
          } else {
            console.log('No citations in result object');
          }
          
          await updateMessage({
            id: msg.id,
            reply: getNormalContent(result.content as string),
            reasoning: getReasoningContent(
              result.content as string,
              result.reasoning,
            ),
            inputTokens,
            outputTokens,
            isActive: 0,
            citedFiles: JSON.stringify(citedFiles.map((f) => f.name)),
            citedChunks: JSON.stringify(
              citedChunks.map((k: any, idx: number) => ({
                seqNo: idx + 1,
                content: k.content,
                id: k.id,
              })),
            ),
            ...(result.citations && { citations: result.citations }),
          });
          useUsageStore.getState().create({
            provider: chatService.provider.name,
            model: modelMapping[model.label || ''] || model.label,
            inputTokens,
            outputTokens,
          });
        }
        updateStates($chatId, { loading: false, runningTool: null });
      };
      chatService.onComplete(onChatComplete);

      // Create refs to track the latest content and reasoning to prevent re-renders
      const lastContentRef = { current: '' };
      const lastReasoningRef = { current: '' };
      
      chatService.onReading((content: string, reasoning?: string) => {
        // Only update if the content or reasoning actually changed
        // This prevents unnecessary state updates
        const newContent = content || '';
        const newReasoning = reasoning || '';
        
        if (newContent !== lastContentRef.current || newReasoning !== lastReasoningRef.current) {
          lastContentRef.current = newContent;
          lastReasoningRef.current = newReasoning;
          appendReply(msg.id, newContent, newReasoning);
          
          if (!isUserScrollingRef.current) {
            scrollToBottom();
          }
        }
      });
      chatService.onToolCalls((toolName: string) => {
        updateStates($chatId, { runningTool: toolName });
      });
      chatService.onError((err: any, aborted: boolean) => {
        console.error(err);
        if (!aborted) {
          notifyError(err.message || err);
        }
        updateStates($chatId, { loading: false });
      });

      await chatService.chat([
        {
          role: 'user',
          content: typeof actualPrompt === 'string' ? actualPrompt : [actualPrompt],
        },
      ]);
      window.electron.ingestEvent([{ app: 'chat' }, { model: model.label }]);
    },
    [
      activeChatId,
      createMessage,
      scrollToBottom,
      createChat,
      updateChat,
      setKeyword,
      countInput,
      countOutput,
      updateMessage,
      navigate,
      appendReply,
      notifyError,
    ],
  );

  return (
    <div id="chat" className="relative h-screen flex flex-start">
      <div className="flex-grow relative">
        <Header key={activeChatId} />
        <div className="h-screen -mx-5 mt-10">
          <SplitPane
            split="horizontal"
            sizes={sizes}
            onChange={setSizes}
            performanceMode
            sashRender={sashRender}
          >
            <Pane className="chat-content flex-grow">
              <div id="messages" ref={ref} className="overflow-y-auto h-full">
                {messages.length ? (
                  <div className="mx-auto max-w-screen-md px-5">
                    <MemoizedMessages messages={messages} />
                  </div>
                ) : chatService.isReady() ? null : (
                  <Empty image="hint" text={t('Notification.APINotReady')} />
                )}
              </div>
            </Pane>
            <Pane minSize={180} maxSize="60%">
              {chatService.isReady() ? (
                <Editor
                  onSubmit={onSubmit}
                  onAbort={() => {
                    chatService.abort();
                  }}
                />
              ) : (
                <div className="flex flex-col justify-center h-3/4 text-center text-sm text-gray-400">
                  {id === tempChatId ? '' : t('Notification.APINotReady')}
                </div>
              )}
            </Pane>
          </SplitPane>
        </div>
      </div>
      <Sidebar chatId={activeChatId} />
      <CitationDialog />
    </div>
  );
}
