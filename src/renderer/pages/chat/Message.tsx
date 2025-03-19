/* eslint-disable jsx-a11y/anchor-has-content */
/* eslint-disable react/no-danger */
import Debug from 'debug';
import useChatStore from 'stores/useChatStore';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useMarkdown from 'hooks/useMarkdown';
import { IChatMessage } from 'intellichat/types';
import { useTranslation } from 'react-i18next';
import { Divider } from '@fluentui/react-components';
import useKnowledgeStore from 'stores/useKnowledgeStore';
import useToast from 'hooks/useToast';
import ToolSpinner from 'renderer/components/ToolSpinner';
import useSettingsStore from 'stores/useSettingsStore';
import { ICollectionFile } from 'types/knowledge';
import {
  getNormalContent,
  getReasoningContent,
  highlight,
} from '../../../utils/util';
import MessageToolbar from './MessageToolbar';
import {
  ChevronDown16Regular,
  ChevronUp16Regular,
  Link16Regular,
  Document16Regular,
  OpenRegular,
  LinkRegular
} from '@fluentui/react-icons';

const debug = Debug('OMNI-OS:pages:chat:Message');

export default function Message({ message }: { message: IChatMessage }) {
  const { t } = useTranslation();
  const { notifyInfo } = useToast();
  const fontSize = useSettingsStore((state) => state.fontSize);
  const keywords = useChatStore((state: any) => state.keywords);
  const states = useChatStore().getCurState();
  const { showCitation } = useKnowledgeStore();
  const keyword = useMemo(
    () => keywords[message.chatId],
    [keywords, message.chatId],
  );
  const citedFiles = useMemo(
    () => JSON.parse(message.citedFiles || '[]'),
    [message.citedFiles],
  );

  const citedChunks = useMemo(() => {
    return JSON.parse(message.citedChunks || '[]');
  }, [message.citedChunks]);

  const { render, processMermaidDiagrams } = useMarkdown();

  // Parse citations if they exist as a JSON string
  const messageCitations = useMemo(() => {
    console.log('Message citations raw:', message.citations);
    
    // Case 1: No citations
    if (!message.citations) {
      console.log('No citations available for message:', message.id);
      return [];
    }
    
    // Case 2: Already an array
    if (Array.isArray(message.citations)) {
      console.log('Citations already in array format:', message.citations);
      return message.citations;
    }
    
    // Case 3: JSON string format (from database)
    try {
      // Try to parse citations if they're stored as a JSON string
      const parsed = JSON.parse(message.citations);
      console.log('Successfully parsed citations from JSON string:', parsed);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.error('Failed to parse citations (invalid JSON):', e);
      
      // Case 4: Plain string fallback (possibly a single citation)
      if (typeof message.citations === 'string' && (message.citations as string).trim()) {
        console.log('Treating citation as a single string URL:', message.citations);
        return [message.citations as string];
      }
      
      return [];
    }
  }, [message.citations, message.id]);

  const onCitationClick = useCallback(
    (event: any) => {
      const url = new URL(event.target?.href);
      if (url.pathname === '/citation' || url.protocol.startsWith('file:')) {
        event.preventDefault();
        const chunkId = url.hash.replace('#', '');
        const chunk = citedChunks.find((i: any) => i.id === chunkId);
        if (chunk) {
          showCitation(chunk.content);
        } else {
          // Check if this is an OMNIBase citation based on collection ID
          const isOmniBase = citedChunks.some((i: any) => 
            i.collectionId && i.collectionId.toString().startsWith('omnibase:')
          );
          
          if (isOmniBase) {
            notifyInfo(t('Knowledge.Notification.CitationNotFound'));
          } else {
            notifyInfo("The citation was not found and may have been deleted");
          }
        }
      }
    },
    [citedChunks, showCitation],
  );

  // Fix the Maximum update depth exceeded warning by moving the side effect outside useEffect
  const setupCitationClickHandlers = () => {
    if(message.isActive) return; // no need to add event listener when message is active
    
    const targetNode = document.getElementById(message.id);
    if (!targetNode) return;
    
    const links = targetNode.querySelectorAll('.msg-reply a');
    if (links.length > 0) {
      links.forEach((link) => {
        link.addEventListener('click', onCitationClick);
      });
    }
  };

  useEffect(() => {
    if(message.isActive) return; // no need to add event listener when message is active
    
    const observer = new MutationObserver(() => {
      setupCitationClickHandlers();
    });

    const targetNode = document.getElementById(message.id);
    if (targetNode) {
      observer.observe(targetNode, {
        childList: true,
        subtree: true,
      });
      
      // Initial setup
      setupCitationClickHandlers();
    }

    return () => {
      observer.disconnect();
      const links = document.querySelectorAll(`#${message.id} .msg-reply a`);
      links.forEach((link) => {
        link.removeEventListener('click', onCitationClick);
      });
    };
  }, [message.id, message.isActive]);

  const [reply, setReply] = useState('');
  const [reasoning, setReasoning] = useState('');

  const [isReasoning, setIsReasoning] = useState(true);
  const [reasoningSeconds, setReasoningSeconds] = useState(0);
  const [isReasoningShow, setIsReasoningShow] = useState(false);
  const messageRef = useRef(message);
  const isReasoningRef = useRef(isReasoning);
  const reasoningInterval = useRef<NodeJS.Timeout | null>(null);
  const reasoningRef = useRef('');
  const replyRef = useRef('');

  useEffect(() => {
    messageRef.current = message;
  }, [message.id, message.isActive]);

  useEffect(() => {
    isReasoningRef.current = isReasoning;
  }, [isReasoning]);

  useEffect(() => {
    // Instead of directly setting state that might trigger a re-render cascade,
    // we need to be more careful about when we update the reasoning state
    const _reply = getNormalContent(message.reply);
    const _reasoning = getReasoningContent(message.reply, message.reasoning);
    
    // We only want to update state if the values are actually different
    // to prevent unnecessary re-renders
    if (replyRef.current !== _reply) {
      setReply(_reply);
      replyRef.current = _reply;
    }
    
    if (reasoningRef.current !== _reasoning) {
      setReasoning(_reasoning);
      reasoningRef.current = _reasoning;

      // Only update isReasoningShow if reasoning is not empty
      if (_reasoning && _reasoning.trim() !== '' && !isReasoningShow) {
        setIsReasoningShow(true);
      }
    }
    
    // Note: we're intentionally NOT updating the refs in this useEffect
    // as that would create another dependency and potentially trigger 
    // additional cascading renders
  }, [message.reply, message.reasoning, isReasoningShow]);

  function monitorThinkStatus() {
    // Clear any existing interval to avoid duplicates
    if (reasoningInterval.current) {
      clearInterval(reasoningInterval.current);
      reasoningInterval.current = null;
    }

    // Start a new monitoring interval
    reasoningInterval.current = setInterval(() => {
      // Only increment reasoning seconds if still in reasoning mode
      if (isReasoningRef.current && messageRef.current.isActive) {
        setReasoningSeconds(prev => prev + 1);
      }

      // Check if we should stop reasoning mode
      const currentReply = replyRef.current;
      if (
        currentReply && 
        currentReply.trim() !== '' &&
        isReasoningRef.current &&
        messageRef.current.isActive
      ) {
        // Stop the interval timer first before changing state
        if (reasoningInterval.current) {
          clearInterval(reasoningInterval.current);
          reasoningInterval.current = null;
        }
        
        // Then update the reasoning state
        setIsReasoning(false);
        
        if (process.env.NODE_ENV !== 'production') {
          debug('Reasoning ended');
          debug(`Total thinking time: ${reasoningSeconds} seconds`);
        }
      }
    }, 1000);
  }

  useEffect(() => {
    if (message.isActive) {
      // Only start monitoring and show reasoning if not already set
      if (!isReasoningShow) {
        setIsReasoningShow(true);
      }
      
      // Only start the monitor if it's not already running
      if (!reasoningInterval.current) {
        monitorThinkStatus();
      }
    } else {
      // When message is no longer active, clean up
      setIsReasoning(false);
      
      // Only process mermaid diagrams when the message is complete
      // Use a small timeout to ensure DOM is fully updated
      setTimeout(() => {
        processMermaidDiagrams();
      }, 200);
    }
    
    return () => {
      if (reasoningInterval.current) {
        clearInterval(reasoningInterval.current);
        reasoningInterval.current = null;
      }
      setReasoningSeconds(0);
    };
  }, [message.isActive, processMermaidDiagrams]);

  const toggleThink = useCallback(() => {
    setIsReasoningShow(!isReasoningShow);
  }, [isReasoningShow]);

  const replyNode = useCallback(() => {
    const isLoading = message.isActive && states.loading;
    const isEmpty =
      (!message.reply || message.reply === '') &&
      (!message.reasoning || message.reasoning === '');
    const thinkTitle =
      (isReasoning ? t('Reasoning.Thinking') : t('Reasoning.Thought')) +
      `${reasoningSeconds > 0 ? ` ${reasoningSeconds}s` : ''}`;
    return (
      <div className={`w-full mt-1.5 ${isLoading ? 'is-loading' : ''}`}>
        {message.isActive && states.runningTool ? (
          <div className="flex flex-row justify-start items-center gap-1">
            <ToolSpinner size={20} style={{ marginBottom: '-3px' }} />
            <span>{states.runningTool.replace('--', ':')}</span>
          </div>
        ) : null}
        {isLoading && isEmpty ? (
          <>
            <span className="skeleton-box" style={{ width: '80%' }} />
            <span className="skeleton-box" style={{ width: '90%' }} />
          </>
        ) : (
          <div className="-mt-1">
            {reasoning.trim() ? (
              <div className="think">
                <div className="think-header" onClick={toggleThink}>
                  <span className={`font-bold text-gray-400 ${fontSize === 'large' ? 'text-base' : ''}`}>{thinkTitle}</span>
                  <div className="text-gray-400 -mb-0.5">
                    {isReasoningShow ? (
                      <ChevronUp16Regular />
                    ) : (
                      <ChevronDown16Regular />
                    )}
                  </div>
                </div>
                <div
                  className="think-body"
                  style={{ display: isReasoningShow ? 'block' : 'none' }}
                >
                  <div
                    className={fontSize === 'large' ? 'font-lg' : ''}
                    dangerouslySetInnerHTML={{
                      __html: render(
                        `${
                          highlight(reasoning, keyword) || ''
                        }${isReasoning && reasoning ? '<span class="blinking-cursor" /></span>' : ''}`,
                      ),
                    }}
                  />
                </div>
              </div>
            ) : null}
            <div
              className={`msg-content p-3 mt-1 break-words ${
                fontSize === 'large' ? 'font-lg' : ''
              }`}
              dangerouslySetInnerHTML={{
                __html: render(
                  `${
                    highlight(reply, keyword) || ''
                  }${isLoading && reply ? '<span class="blinking-cursor" /></span>' : ''}`,
                ),
              }}
            />
          </div>
        )}
      </div>
    );
  }, [
    reply,
    reasoning,
    keyword,
    states,
    fontSize,
    isReasoning,
    reasoningSeconds,
    isReasoningShow,
  ]);

  return (
    <div className="leading-6 message" id={message.id}>
      <div>
        <a
          id={`prompt-${message.id}`}
          aria-label={`prompt of message ${message.id}`}
        />

        <div
          className="msg-prompt my-2 flex flex-start"
          style={{ minHeight: '40px' }}
        >
          <div className="avatar flex-shrink-0 mr-2" />
          <div
            className={`msg-content p-3 mt-1 break-words ${
              fontSize === 'large' ? 'font-lg' : ''
            }`}
            dangerouslySetInnerHTML={{
              __html: render(highlight(message.prompt, keyword) || ''),
            }}
          />
        </div>
      </div>
      <div>
        <a id={`#reply-${message.id}`} aria-label={`Reply ${message.id}`} />
        <div
          className="msg-reply mt-2 flex flex-start"
          style={{ minHeight: '40px' }}
        >
          <div className="avatar flex-shrink-0 mr-2" />
          <div className="flex-grow">
            {replyNode()}
          </div>
        </div>
        {citedFiles.length > 0 && (
          <div className="message-cited-files mt-4">
            <div className="mb-3">
              <Divider>
                <span className="flex items-center gap-2 px-2 text-gray-600 dark:text-gray-300">
                  <Document16Regular className="text-amber-500" />
                  {t('Common.References')}
                </span>
              </Divider>
            </div>
            <ul className="pl-4 list-none space-y-2">
              {citedFiles.map((fileName: string, idx: number) => (
                <li 
                  key={idx} 
                  className="mb-1 overflow-hidden text-ellipsis transition-all duration-200 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-md p-2"
                >
                  <div className="flex items-start">
                    <span className="flex-shrink-0 inline-flex items-center justify-center h-6 w-6 rounded-full bg-amber-500 dark:bg-amber-600 text-white dark:text-white mr-2 text-xs font-bold">
                      {idx + 1}
                    </span>
                    <span className="text-sm text-gray-700 dark:text-gray-300 flex-grow">
                      {fileName || `Document ${idx + 1}`}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
        
        {/* Display citations/references from the API response if they exist */}
        {messageCitations.length > 0 ? (
          <div className="message-citations mt-4">
            <div className="mb-3">
              <Divider>
                <span className="flex items-center gap-2 px-2 text-gray-600 dark:text-gray-300">
                  <LinkRegular className="text-blue-500" />
                  {t('Common.Citations')}
                </span>
              </Divider>
            </div>
            <ul className="pl-4 list-none space-y-2">
              {messageCitations.map((citation: string, idx: number) => (
                <li 
                  key={idx} 
                  className="mb-1 overflow-hidden text-ellipsis transition-all duration-200 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-md p-2"
                >
                  <div className="flex items-start">
                    <span className="flex-shrink-0 inline-flex items-center justify-center h-6 w-6 rounded-full bg-blue-500 dark:bg-blue-600 text-white dark:text-white mr-2 text-xs font-bold">
                      {idx + 1}
                    </span>
                    <a 
                      href={citation} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-600 dark:text-blue-400 hover:underline text-sm flex-grow overflow-hidden text-ellipsis"
                      onClick={(e) => {
                        e.preventDefault();
                        window.electron.openExternal(citation);
                      }}
                    >
                      {citation}
                      <OpenRegular className="inline-block ml-1 text-gray-500 dark:text-gray-400" fontSize={12} />
                    </a>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          // Extract references from the message content if no explicit citations array exists
          reply.match(/\[\d+\]/g) && (
            <div className="message-references mt-4">
              <div className="mb-3">
                <Divider>
                  <span className="flex items-center gap-2 px-2 text-gray-800 dark:text-gray-200">
                    <LinkRegular className="text-blue-500" />
                    {t('Common.References')}
                  </span>
                </Divider>
              </div>
            </div>
          )
        )}
        
        <MessageToolbar message={message} />
      </div>
    </div>
  );
}
