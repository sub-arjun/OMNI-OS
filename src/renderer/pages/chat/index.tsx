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
import { PdfAttachment } from './Editor';

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
  generateExamplePrompts,
} from '../../../utils/util';
import INextChatService from 'intellichat/services/INextCharService';
import useSettingsStore from 'stores/useSettingsStore';
import Sidebar from './Sidebar/Sidebar';
import useInspectorStore from 'stores/useInspectorStore';
import React from 'react';
import useAppearanceStore from 'stores/useAppearanceStore';
import { ChevronDown16Filled } from '@fluentui/react-icons';

const debug = Debug('OMNI-OS:pages:chat');

const MemoizedMessages = React.memo(Messages);

// Update the SafeText component
const SafeText = ({ text }: { text: string }) => {
  // Check the raw text for debugging
  console.log('SafeText received text:', text, typeof text);
  
  // Make sure we always return a valid string
  if (!text || typeof text !== 'string') {
    return <span className="italic text-gray-500">Loading prompt...</span>;
  }
  
  // Only sanitize minimal problematic characters, preserve most formatting
  const sanitized = text.trim();
  
  if (!sanitized) {
    return <span className="italic text-gray-500">Loading prompt...</span>;
  }
  
  return <span>{sanitized}</span>;
};

// Function to get random greeting message and icon
const getGreetingData = () => {
  // Determine time of day
  const hour = new Date().getHours();
  
  if (hour >= 5 && hour < 12) {
    return {
      greeting: "Good Morning",
      icon: (
        <svg className="w-10 h-10 mr-4 text-amber-500" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 3.75a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5a.75.75 0 01.75-.75zM12 17.25a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5a.75.75 0 01.75-.75zM20.25 12a.75.75 0 01-.75.75h-1.5a.75.75 0 010-1.5h1.5a.75.75 0 01.75.75zM6.75 12a.75.75 0 01-.75.75h-1.5a.75.75 0 010-1.5h1.5a.75.75 0 01.75.75zM16.97 7.03a.75.75 0 01.03 1.06l-1.061 1.06a.75.75 0 11-1.06-1.06l1.06-1.06a.75.75 0 011.061 0zM9.121 14.879a.75.75 0 01.03 1.06l-1.061 1.06a.75.75 0 11-1.06-1.06l1.06-1.06a.75.75 0 011.061 0zM16.97 16.97a.75.75 0 01-1.06 0l-1.06-1.06a.75.75 0 011.06-1.06l1.06 1.06a.75.75 0 010 1.06zM9.121 9.121a.75.75 0 01-1.06 0L7 8.06A.75.75 0 118.06 7l1.06 1.06a.75.75 0 010 1.061zM12 7.75a4.25 4.25 0 100 8.5 4.25 4.25 0 000-8.5z"/>
        </svg>
      ),
      timeClass: "text-amber-500 dark:text-amber-400"
    };
  } else if (hour >= 12 && hour < 18) {
    return {
      greeting: "Good Afternoon",
      icon: (
        <svg className="w-10 h-10 mr-4 text-amber-500" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2.25a.75.75 0 01.75.75v2.25a.75.75 0 01-1.5 0V3a.75.75 0 01.75-.75zM7.5 12a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM12 18.75a.75.75 0 01.75.75v2.25a.75.75 0 01-1.5 0v-2.25a.75.75 0 01.75-.75zM21.75 12a.75.75 0 01-.75.75h-2.25a.75.75 0 010-1.5H21a.75.75 0 01.75.75zM5.25 12a.75.75 0 01-.75.75H2.25a.75.75 0 010-1.5H4.5a.75.75 0 01.75.75z"/>
        </svg>
      ),
      timeClass: "text-amber-500 dark:text-amber-400"
    };
  } else {
    return {
      greeting: "Good Evening",
      icon: (
        <svg className="w-10 h-10 mr-4 text-indigo-400" viewBox="0 0 24 24" fill="currentColor">
          <path fillRule="evenodd" d="M9.528 1.718a.75.75 0 01.162.819A8.97 8.97 0 009 6a9 9 0 009 9 8.97 8.97 0 003.463-.69.75.75 0 01.981.98 10.503 10.503 0 01-9.694 6.46c-5.799 0-10.5-4.701-10.5-10.5 0-4.368 2.667-8.112 6.46-9.694a.75.75 0 01.818.162z" clipRule="evenodd" />
        </svg>
      ),
      timeClass: "text-indigo-500 dark:text-indigo-400"
    };
  }
};

// Function to get a random call to action
const getRandomCallToAction = () => {
  const callToActions = [
    "What do you want to get done?",
    "What can OMNI do for you?",
    "Become OMNI with your next request",
    "How can I help you today?",
    "What shall we accomplish together?",
    "Ready to tackle your next challenge",
    "What would you like to create?",
    "How can we elevate your work today?",
    "What's on your mind for OMNI to solve?",
    "What project are we working on today?"
  ];
  
  // Return a random item from the array
  return callToActions[Math.floor(Math.random() * callToActions.length)];
};

// EmptyChat component for showing greeting
const EmptyChat = React.memo(({ onSubmitPrompt }: { onSubmitPrompt: (prompt: string) => void }) => {
  const greetingData = getGreetingData();
  const [prompts, setPrompts] = useState<Array<{text: string; type: string}>>([]);
  const [loading, setLoading] = useState(true);
  const { t } = useTranslation();
  const [callToAction] = useState(getRandomCallToAction());
  
  // Get user's name from Electron store or fallback to default
  const [userName, setUserName] = useState<string>("");
  
  // Add ref to track if a fetch is already in progress
  const isFetchingRef = useRef(false);
  
  // Function to fetch and set suggestions
  const fetchSuggestions = useCallback(async () => {
    // Prevent concurrent calls to generateExamplePrompts
    if (isFetchingRef.current) {
      console.log('A fetch is already in progress, skipping this request');
      return;
    }
    
    isFetchingRef.current = true;
    setLoading(true);
    let aiGeneratedPrompts;
    
    try {
      // Fetch user name if not already set
      if (!userName) {
        const userData = await window.electron.store.get('user');
        if (userData && userData.name) {
          setUserName(userData.name);
        }
      }
      
      // First, query database for historical prompts
      console.log('Getting first messages from each chat for suggestions');
      let recentPrompts: Array<{prompt: string}> = [];
      
      try {
        // Query the database for the first message from each chat to use as suggestion prompts
        recentPrompts = await window.electron.db.all<{prompt: string}>(
          `SELECT m.prompt 
           FROM messages m
           INNER JOIN (
             SELECT chatId, MIN(createdAt) as first_message_time
             FROM messages
             WHERE prompt IS NOT NULL
             GROUP BY chatId
           ) first_msgs
           ON m.chatId = first_msgs.chatId AND m.createdAt = first_msgs.first_message_time
           WHERE m.prompt IS NOT NULL AND length(m.prompt) > 10 AND length(m.prompt) < 150
           ORDER BY m.createdAt DESC
           LIMIT 15`,
          []
        );
        
        console.log('Fetched recent user prompts:', recentPrompts);
      } catch (err) {
        console.error("Failed to fetch suggestions from database:", err);
        recentPrompts = [];
      }
      
      // Determine what messages to use for AI prompt generation
      let messagesForPrompt = [];
      
      if (recentPrompts && Array.isArray(recentPrompts) && recentPrompts.length >= 2) {
        // We have database prompts - use them
        // Shuffle the prompts to ensure random selection
          const shuffled = [...recentPrompts].sort(() => 0.5 - Math.random());
        // Take two random prompts from database history
        const selectedPrompts = shuffled.slice(0, 2);
        
        // Map them to the format expected by generateExamplePrompts
        messagesForPrompt = selectedPrompts.map((item, index) => ({
          role: 'user',
          content: item.prompt
        }));
        
        console.log('Using historical prompts as context for AI generation:', 
          messagesForPrompt.map(m => m.content));
      } else {
        // Try to use current chat messages if available
        const currentMessages = useChatStore.getState().messages;
        const recentMessagesForPrompt = currentMessages.slice(-2);
        
        // Map messages to the format expected by generateExamplePrompts
        messagesForPrompt = recentMessagesForPrompt.map(msg => {
          if (msg.reply && msg.reply.trim() !== '') {
            return { role: 'assistant', content: msg.reply };
          } else {
            return { role: 'user', content: msg.prompt };
          }
        }).filter(msg => msg.content && msg.content.trim() !== '');
      }
      
      // Generate AI prompts based on context (or generic if no context)
      console.log('Generating AI prompts with context:', messagesForPrompt);
      aiGeneratedPrompts = await generateExamplePrompts(messagesForPrompt);
      console.log('Generated AI prompts result:', JSON.stringify(aiGeneratedPrompts));
      
      // Format and combine all prompts
      try {
        if (recentPrompts && Array.isArray(recentPrompts) && recentPrompts.length > 0) {
          // Colors for the different prompt types
          const colorTypes = ['blue', 'purple', 'green'] as const;
          
          // If we have AI generated prompts, use them
          if (aiGeneratedPrompts && aiGeneratedPrompts.length > 0) {
            // Use all three prompts from aiGeneratedPrompts - it already contains
            // the two context prompts plus the generated third prompt
            const formattedPrompts = aiGeneratedPrompts.map((prompt, index) => ({
              text: prompt.text,
              type: colorTypes[index % 3]
            }));
            
            console.log('Using AI-generated prompts with historical context:', formattedPrompts);
            setPrompts(formattedPrompts);
          } else {
            // If AI generation failed, fall back to database prompts
            const shuffled = [...recentPrompts].sort(() => 0.5 - Math.random());
            const formattedPrompts = shuffled.slice(0, 3).map((item, index) => ({
              text: item.prompt,
              type: colorTypes[index % 3]
            }));
            
            console.log('Falling back to only database prompts:', formattedPrompts);
            setPrompts(formattedPrompts);
          }
        } else {
          // If no database prompts, use only AI-generated ones
          console.log("No past prompts available, using AI-generated suggestions:", aiGeneratedPrompts);
          setPrompts(aiGeneratedPrompts);
        }
      } catch (err) {
        console.error("Failed to format and set prompts:", err);
        // If formatting fails, just use AI prompts directly
        console.log('Falling back to AI-generated suggestions:', aiGeneratedPrompts);
        setPrompts(aiGeneratedPrompts);
      }
    } catch (err) {
      console.error("Error in fetchSuggestions:", err);
      // Use hardcoded fallback prompts instead of making another API call
      const fallbackPrompts = [
        { text: "Analyze key performance indicators for efficiency", type: "blue" },
        { text: "Develop strategic roadmap for digital transformation", type: "purple" },
        { text: "Optimize supply chain logistics for manufacturing", type: "green" }
      ];
      console.log('Using hardcoded fallback prompts:', fallbackPrompts);
      setPrompts(fallbackPrompts);
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, [userName]);
  
  // Initial fetch on component mount
  useEffect(() => {
    fetchSuggestions();
  }, [fetchSuggestions]);
  
  // Set up a 30-minute refresh interval
  useEffect(() => {
    // Set timer to refresh suggestions every 30 minutes
    const refreshTimer = setInterval(() => {
      console.log("Refreshing suggestions (30-minute interval)");
      fetchSuggestions();
    }, 30 * 60 * 1000); // 30 minutes in milliseconds
    
    // Clean up the timer when component unmounts
    return () => clearInterval(refreshTimer);
  }, [fetchSuggestions]);
  
  const handleSuggestionClick = (suggestion: string) => {
    onSubmitPrompt(suggestion);
  };
  
  return (
    <div className="flex flex-col items-center justify-start pt-4 pb-12 px-5 text-center">
      {/* Anthropic-style greeting with time-based icon */}
      <div className="mb-10 flex items-center">
        <div className="text-center">
          <div className="inline-flex flex-col items-center justify-center p-6 bg-gray-50 dark:bg-gray-800/40 rounded-2xl backdrop-blur-sm shadow-md animate-fade-in-scale max-w-2xl w-full">
            {/* Top row with icon and greeting */}
            <div className="flex items-center w-full justify-center">
              <div className="flex-shrink-0">
                {React.cloneElement(greetingData.icon as React.ReactElement, {
                  className: `w-12 h-12 mr-5 ${greetingData.timeClass}`
                })}
              </div>
              <h1 className="text-5xl font-semibold text-gray-800 dark:text-gray-100 tracking-tight">
                {greetingData.greeting}{userName ? `, ${userName}` : ''}
              </h1>
            </div>
            
            {/* Call to action in greeting card - now randomized */}
            <h2 className="text-2xl font-medium text-gray-900 dark:text-white mt-4">
              {callToAction}
            </h2>
          </div>
        </div>
      </div>
      
      {/* Prompt suggestions (now using past user messages) */}
      <div className="max-w-2xl w-full">
        {loading ? (
          <div className="flex justify-center items-center py-8">
            <div className="animate-pulse-slow opacity-60 text-gray-500 text-lg">Loading suggestions...</div>
          </div>
        ) : prompts.length > 0 ? (
          <div className="grid grid-cols-1 gap-4">
            {prompts.map((prompt, index) => (
              <button 
                key={index}
                className={`suggestion-button ${prompt.type}-suggestion text-left p-5 rounded-xl cursor-pointer transition-all duration-200 shadow-sm hover:shadow-md border border-opacity-60 ${
                  prompt.type === 'blue' 
                    ? 'bg-blue-50 dark:bg-blue-900/40 text-blue-900 dark:text-blue-100 border-blue-200 dark:border-blue-800/60 hover:border-blue-300 dark:hover:border-blue-600' 
                    : prompt.type === 'purple'
                      ? 'bg-purple-50 dark:bg-purple-900/40 text-purple-900 dark:text-purple-100 border-purple-200 dark:border-purple-800/60 hover:border-purple-300 dark:hover:border-purple-600'
                      : 'bg-green-50 dark:bg-green-900/40 text-green-900 dark:text-green-100 border-green-200 dark:border-green-800/60 hover:border-green-300 dark:hover:border-green-600'
                }`}
                onClick={() => handleSuggestionClick(typeof prompt.text === 'string' ? prompt.text : "")}
              >
                <div className="text-base font-medium">
                  {typeof prompt.text === 'string' ? prompt.text.trim() : ''}
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="flex flex-col justify-center items-center gap-4 py-8">
            <div className="text-gray-500 max-w-md text-center">
              <p className="mb-4">Type your question or request in the box below to get started.</p>
              <div className="text-sm opacity-75">
                You can ask about anything from enterprise planning to technical analysis.
              </div>
            </div>
          </div>
        )}
      </div>
      
      <style>{`
        @keyframes fade-in {
          0% { opacity: 0; transform: translateY(10px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        
        @keyframes fade-in-scale {
          0% { opacity: 0; transform: scale(0.95); }
          100% { opacity: 1; transform: scale(1); }
        }
        
        @keyframes pulse-slow {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
        
        .animate-pulse-slow {
          animation: pulse-slow 2s ease-in-out infinite;
        }
        
        .animate-fade-in-scale {
          animation: fade-in-scale 0.8s ease-out forwards;
        }
        
        .suggestion-button {
          position: relative;
          overflow: hidden;
          transition: all 0.3s ease;
          animation: fade-in 0.8s ease-out forwards;
        }
        
        .suggestion-button:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }
        
        .suggestion-button::before {
          content: '';
          position: absolute;
          left: 0;
          bottom: 0;
          height: 3px;
          width: 100%;
          transform: scaleX(0);
          transform-origin: left;
          transition: transform 0.3s ease;
        }
        
        .suggestion-button:hover::before {
          transform: scaleX(1);
        }
        
        .blue-suggestion::before {
          background-color: #3b82f6;
        }
        
        .purple-suggestion::before {
          background-color: #8b5cf6;
        }
        
        .green-suggestion::before {
          background-color: #10b981;
        }
        
        .blue-suggestion:hover {
          box-shadow: 0 4px 14px rgba(59, 130, 246, 0.35);
        }
        
        .purple-suggestion:hover {
          box-shadow: 0 4px 14px rgba(139, 92, 246, 0.35);
        }
        
        .green-suggestion:hover {
          box-shadow: 0 4px 14px rgba(16, 185, 129, 0.35);
        }
        
        .dark .blue-suggestion:hover {
          box-shadow: 0 4px 14px rgba(96, 165, 250, 0.5);
        }
        
        .dark .purple-suggestion:hover {
          box-shadow: 0 4px 14px rgba(167, 139, 250, 0.5);
        }
        
        .dark .green-suggestion:hover {
          box-shadow: 0 4px 14px rgba(52, 211, 153, 0.5);
        }
      `}</style>
    </div>
  );
});

export default function Chat() {
  const { t } = useTranslation();
  const id = useParams().id || tempChatId;
  const anchor = useParams().anchor || null;

  const [activeChatId, setActiveChatId] = useState(id);
  if (activeChatId !== id) {
    setActiveChatId(id);
    debug('Set chat id:', id);
  }
  const [sizes, setSizes] = useState(['auto', 215]);
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
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);

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

  // Modify the handleScroll function to detect when to show the scroll button
  const handleScroll = useRef(
    debounce(
      () => {
        if (ref.current) {
          const { scrollTop, scrollHeight, clientHeight } = ref.current;
          const atBottom = scrollTop + clientHeight >= scrollHeight - 50;
          
          // Show scroll button when not at bottom and have scrolled up a significant amount
          if (scrollHeight > clientHeight) {
            setShowScrollToBottom(!atBottom && scrollTop < scrollHeight - clientHeight - 200);
          } else {
            setShowScrollToBottom(false);
          }
          
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

  // Function to handle scroll to bottom button click
  const handleScrollToBottomClick = useCallback(() => {
    if (ref.current) {
      ref.current.scrollTo({
        top: ref.current.scrollHeight,
        behavior: 'smooth'
      });
      // Reset user scrolling after animation completes
      setTimeout(() => {
        isUserScrollingRef.current = false;
        setShowScrollToBottom(false);
      }, 500);
    }
  }, []);

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

  const sashRender = () => (
    <div className="resize-handle-container">
      <div className="border-t border-base w-full"></div>
      <div className="resize-handle-indicator">
        <div className="resize-handle-pill"></div>
      </div>
    </div>
  );

  const createMessage = useChatStore((state) => state.createMessage);
  const createChat = useChatStore((state) => state.createChat);
  const deleteStage = useChatStore((state) => state.deleteStage);
  const { countInput, countOutput } = useToken();
  const updateMessage = useChatStore((state) => state.updateMessage);
  const appendReply = useChatStore((state) => state.appendReply);

  const { moveChatCollections, listChatCollections, setChatCollections } =
    useChatKnowledgeStore.getState();

  // Refs to track the delta between debounced calls
  const deltaContentRef = useRef('');
  const deltaReasoningRef = useRef('');

  // Use useRef to store the debounced function to ensure stability
  const debouncedAppendReply = useRef(
    // Debounced function reads delta refs, calls appendReply, then resets refs
    debounce((messageId: string) => {
      const contentDelta = deltaContentRef.current;
      const reasoningDelta = deltaReasoningRef.current;
      
      // Reset refs immediately for the next accumulation period
      deltaContentRef.current = '';
      deltaReasoningRef.current = '';
      
      // Call the original store action with the collected delta
      if (contentDelta || reasoningDelta) {
        appendReply(messageId, contentDelta, reasoningDelta);
      }
    }, 150, { // Adjust as needed
      leading: false,
      trailing: true,
      maxWait: 500 
    })
  ).current;

  const onSubmit = useCallback(
    // Update signature to accept optional PDF
    async (prompt: string, pdf?: PdfAttachment) => {
      // Check if prompt is empty AND no PDF is attached
      if (prompt.trim() === '' && !pdf) {
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

      scrollToBottom(); // Initial scroll

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
            
            // COMPREHENSIVE LOGGING FOR TOKEN DEBUGGING
            console.log(`[KNOWLEDGE DEBUG] Chunk ${idx + 1}:`, {
              id: k.id,
              collectionId: k.collectionId,
              isOmnibase,
              contentLength: content.length,
              contentPreview: content.substring(0, 200) + '...',
              estimatedTokens: Math.ceil(content.length / 4) // Rough estimate
            });
            
            return {
              seqNo: idx + 1,
              file: fileName,
              id: k.id,
              content: content,
            };
          });
          
          debug(`Formatted ${formattedChunks.length} knowledge chunks for RAG`);
          
          // Calculate total knowledge size
          const totalKnowledgeChars = formattedChunks.reduce((sum: number, chunk: any) => sum + chunk.content.length, 0);
          const estimatedKnowledgeTokens = Math.ceil(totalKnowledgeChars / 4);
          
          console.log('[KNOWLEDGE DEBUG] Total knowledge stats:', {
            numChunks: formattedChunks.length,
            totalChars: totalKnowledgeChars,
            estimatedTokens: estimatedKnowledgeTokens,
            jsonStringLength: JSON.stringify(formattedChunks).length
          });
          
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
          
          // Log the final prompt size
          console.log('[KNOWLEDGE DEBUG] Final actualPrompt stats:', {
            totalLength: actualPrompt.length,
            estimatedTokens: Math.ceil(actualPrompt.length / 4),
            originalPromptLength: prompt.length,
            knowledgeOverhead: actualPrompt.length - prompt.length
          });
        }
      }

      // Prepare the content for the API call
      let apiContent: string | any[] = prompt;
      if (pdf) {
        apiContent = [
          { type: "text", text: prompt },
          {
            type: "file",
            file: {
              filename: pdf.filename,
              file_data: pdf.dataUrl
            }
          }
        ];
        console.log('Formatted message with PDF for API:', apiContent);
      } else if (typeof actualPrompt === 'string' && actualPrompt !== prompt) {
        // Handle case where RAG added context
        apiContent = actualPrompt;
      }

      const onChatComplete = async (result: IChatResponseMessage) => {
        // Ensure any remaining delta is flushed
        // Use a direct call to appendReply here, not the debounced one, to ensure final state
        const finalContentDelta = deltaContentRef.current;
        const finalReasoningDelta = deltaReasoningRef.current;
        if (finalContentDelta || finalReasoningDelta) {
           appendReply(msg.id, finalContentDelta, finalReasoningDelta);
           deltaContentRef.current = '';
           deltaReasoningRef.current = '';
        }
        // Cancel any pending debounced calls as we've flushed manually
        debouncedAppendReply.cancel(); 
        
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

      // Reset delta refs for new message stream
      deltaContentRef.current = '';
      deltaReasoningRef.current = '';
      
      chatService.onReading((contentChunk: string, reasoningChunk?: string) => {
        const newContent = contentChunk || '';
        const newReasoning = reasoningChunk || '';

        // Accumulate the delta immediately
        deltaContentRef.current += newContent;
        deltaReasoningRef.current += newReasoning;

        // Trigger the debounced function (which will read and reset the refs later)
        debouncedAppendReply(msg.id);

        // Scroll more frequently if needed, outside the debounce
        if (!isUserScrollingRef.current) {
            scrollToBottom();
        }
      });

      chatService.onToolCalls((toolName: string) => {
        // Ensure any remaining delta is flushed before tool call UI update
        const finalContentDelta = deltaContentRef.current;
        const finalReasoningDelta = deltaReasoningRef.current;
        if (finalContentDelta || finalReasoningDelta) {
           appendReply(msg.id, finalContentDelta, finalReasoningDelta);
           deltaContentRef.current = '';
           deltaReasoningRef.current = '';
        }
        debouncedAppendReply.cancel();
        updateStates($chatId, { runningTool: toolName });
      });

      chatService.onError((err: any, aborted: boolean) => {
        // Ensure any remaining delta is flushed on error
        const finalContentDelta = deltaContentRef.current;
        const finalReasoningDelta = deltaReasoningRef.current;
        if (finalContentDelta || finalReasoningDelta) {
           appendReply(msg.id, finalContentDelta, finalReasoningDelta);
           deltaContentRef.current = '';
           deltaReasoningRef.current = '';
        }
        debouncedAppendReply.cancel();
        console.error(err);
        if (!aborted) {
          notifyError(err.message || err);
        }
        updateStates($chatId, { loading: false });
      });

      await chatService.chat([
        {
          role: 'user',
          content: apiContent,
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
      debouncedAppendReply,
    ],
  );

  const chatSidebar = useAppearanceStore((state) => state.chatSidebar);

  // Log chatSidebar state changes
  useEffect(() => {
    console.log(`Chat.tsx: chatSidebar.show changed to: ${chatSidebar.show}`);
  }, [chatSidebar.show]);

  return (
    <div id="chat" className="relative h-screen flex flex-start">
      <div className="flex-grow relative flex flex-col overflow-hidden">
        <Header key={activeChatId} />
        <div className="flex-grow">
          <SplitPane
            split="horizontal"
            sizes={sizes} // Real-time resizing as the user drags the pill
            onChange={setSizes} // Updates sizes state during drag
            performanceMode
            sashRender={sashRender}
          >
            <Pane className="chat-content flex-grow">
              <div id="messages" ref={ref} className="overflow-y-auto h-full">
                {messages.length ? (
                  <div className="mx-auto max-w-screen-md px-5">
                    <MemoizedMessages messages={messages} />
                  </div>
                ) : chatService.isReady() ? (
                  <EmptyChat onSubmitPrompt={onSubmit} />
                ) : (
                  <Empty image="hint" text={t('Notification.APINotReady')} />
                )}
                
                {/* Scroll to bottom button */}
                {showScrollToBottom && (
                  <div 
                    className="scroll-to-bottom-button"
                    onClick={handleScrollToBottomClick}
                    title={t('Common.ScrollToLatest')}
                  >
                    <ChevronDown16Filled />
                    <span className="scroll-label">{t('Common.ScrollToLatest')}</span>
                  </div>
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
      {chatSidebar.show && <Sidebar chatId={activeChatId} />}
      <CitationDialog />
      
      {/* Add styles for the scroll to bottom button */}
      <style>{`
        .scroll-to-bottom-button {
          position: absolute;
          bottom: 16px;
          left: 50%;
          transform: translateX(-50%);
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 4px;
          background-color: var(--colorNeutralBackground1);
          color: var(--colorNeutralForeground1);
          border: 1px solid var(--colorNeutralStroke1);
          box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1);
          border-radius: 16px;
          padding: 4px 12px;
          font-size: 12px;
          cursor: pointer;
          z-index: 10;
          transition: all 0.2s ease;
          animation: fadeIn 0.3s ease;
        }
        
        .scroll-to-bottom-button:hover {
          background-color: var(--colorNeutralBackground1Hover);
          transform: translateX(-50%) translateY(-2px);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
        }

        .scroll-to-bottom-button .scroll-label {
          margin-top: 1px;
        }

        @media (max-width: 640px) {
          .scroll-to-bottom-button .scroll-label {
            display: none;
          }
          .scroll-to-bottom-button {
            padding: 4px;
            border-radius: 50%;
          }
        }
        
        @keyframes fadeIn {
          from { opacity: 0; transform: translateX(-50%) translateY(10px); }
          to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>
    </div>
  );
}
