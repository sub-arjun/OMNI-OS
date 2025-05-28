/* eslint-disable jsx-a11y/anchor-has-content */
/* eslint-disable react/no-danger */
import Debug from 'debug';
import useChatStore from 'stores/useChatStore';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useMarkdown from 'hooks/useMarkdown';
import useMermaidRenderer from 'hooks/useMermaidRenderer';
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

// Define the array of thinking phrases - Funny OMNI Theme
const thinkingPhrases = [
  "Recalibrating the OMNI-matrix...",
  "Accessing OMNI's vast neural net... careful, it tickles!",
  "Engaging OMNI-warp drive... prepare for insight!",
  "OMNI is processing... please hold while awesome is compiled.",
  "Consulting the OMNI-codex for optimal results...",
  "OMNI-bots are assembling your answer...",
  "Running OMNI-simulations... probability of success: high!",
  "Charging the OMNI-capacitors... Zzzzt!",
  "Polishing the OMNI-crystal ball (it's digital, mostly)...",
  "OMNI's gears are turning (metaphorically, of course)...",
  "Decoding the OMNI-stream of consciousness...",
  "Just conferring with the OMNI hive-mind...",
  "OMNI is thinking... so you don't have to (as hard)!",
  "Activating OMNI-level analysis protocols...",
  "Unpacking OMNI-knowledge... handle with care!",
  "OMNI-gnostic circuits engaged!",
  "Searching the OMNI-verse for enlightenment...",
  "Tuning the OMNI-frequencies for maximum clarity...",
  "Bribing the digital hamsters to run faster on their wheels...",
  "Asking the rubber duck for its expert opinion...",
  "Performing ancient AI rituals... *chants in binary*",
  "Feeding the neural network some brain food (electrons)...",
  "Untangling the spaghetti code of the universe...",
  "Negotiating with the quantum particles for better answers...",
  "Downloading more RAM from the cloud (just kidding)...",
  "Teaching the neurons how to dance in formation...",
  "Consulting the magic 8-ball database...",
  "Warming up the thinking tubes... almost there!",
  "Asking my AI friends for their hot takes...",
  "Dividing by zero to see what happens... wait, no!",
  "Turning thoughts into words, words into wisdom...",
  "Shaking the knowledge tree to see what falls out...",
  "Applying percussive maintenance to the logic circuits...",
  "Convincing the bits to become bytes...",
  "Summoning the spirit of Alan Turing...",
  "Calculating the meaning of life, universe, and your question...",
  "Defragmenting the wisdom hard drive...",
  "Asking the wise old mainframe for advice...",
  "Rebooting creativity.exe... please wait...",
  "Translating your thoughts from human to awesome...",
  "Brewing a fresh pot of digital coffee for inspiration...",
  "Tickling the neurons until they cooperate...",
  "Performing interpretive dance with data structures...",
  "Consulting the ancient scrolls of Stack Overflow...",
  "Waking up the lazy algorithms from their nap...",
  "Convincing the CPU to work overtime (no pay)...",
  "Playing 20 questions with the knowledge base...",
  "Teaching monkeys to type Shakespeare... getting close!",
  "Googling how to be an AI... wait, that's cheating!",
  "Spinning up the hamster wheels of innovation...",
  "Asking the pixels to arrange themselves meaningfully...",
  "Borrowing processing power from nearby calculators...",
  "Sacrificing bugs to the coding gods...",
  "Converting caffeine into code at maximum efficiency...",
  "Herding the cat videos away from the important data...",
  "Negotiating peace between tabs and spaces...",
  "Consulting the fortune cookies in the database...",
  "Teaching electrons to do the electric slide...",
  "Mining for bitcoins of wisdom in the data caves...",
  "Asking the wise owl of the internet for guidance...",
  "Performing a rain dance for a shower of insights...",
  "Assembling Voltron from scattered thoughts...",
  "Baking knowledge cookies at 350°F (in CPU temp)...",
  "Convincing shy ideas to come out and play...",
  "Rolling dice to determine the best answer... all sixes!",
  "Dusting off the old encyclopedia neurons...",
  "Practicing mental gymnastics... stuck the landing!",
  "Mixing a cocktail of wisdom and wit...",
  "Training carrier pigeons to deliver thoughts faster...",
  "Building a bridge between question and answer...",
  "Painting a masterpiece with words and logic...",
  "Conducting the symphony of synapses...",
  "Knitting a cozy sweater of knowledge...",
  "Playing chess with the decision tree... checkmate soon!",
  "Fishing for insights in the data lake...",
  "Climbing the mountain of understanding...",
  "Solving the Rubik's cube of your request...",
  "Assembling IKEA furniture... I mean, your answer...",
  "Teaching the AI to juggle multiple concepts...",
  "Practicing telepathy with the mainframe...",
  "Watering the idea garden for fresh thoughts...",
];

// Helper function to get a random phrase
const getRandomThinkingPhrase = () => 
  thinkingPhrases[Math.floor(Math.random() * thinkingPhrases.length)];

// Simple thinking phrase display with inline styles
const ThinkingPhraseDisplay = React.memo(() => {
  const [currentPhrase, setCurrentPhrase] = useState(
    thinkingPhrases[Math.floor(Math.random() * thinkingPhrases.length)]
  );
  
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentPhrase(thinkingPhrases[Math.floor(Math.random() * thinkingPhrases.length)]);
    }, 8000);
    
    return () => clearInterval(interval);
  }, []);
  
  return (
    <div className="omni-thinking-phrase">{currentPhrase}</div>
  );
});

export default function Message({ message }: { message: IChatMessage }) {
  const { t } = useTranslation();
  const { notifyInfo } = useToast();
  const fontSize = useSettingsStore((state) => state.fontSize);
  const keywords = useChatStore((state: any) => state.keywords);
  const states = useChatStore().getCurState();
  const { showCitation } = useKnowledgeStore();
  const [isReasoning, setIsReasoning] = useState(true);
  const [reasoningSeconds, setReasoningSeconds] = useState(0);
  const [isReasoningShow, setIsReasoningShow] = useState(false);
  const messageRef = useRef(message);
  const isReasoningRef = useRef(isReasoning);
  const reasoningInterval = useRef<NodeJS.Timeout | null>(null);
  const reasoningRef = useRef('');
  const replyRef = useRef('');
  
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

  const { render } = useMarkdown();
  const { processMermaidDiagrams } = useMermaidRenderer(message.id);

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
    
    // DEBUG: Test with a hardcoded mermaid diagram
    if (_reply && _reply.includes('test-mermaid')) {
      console.log('[Mermaid] Testing with hardcoded mermaid diagram');
      const testReply = `Here's a test diagram:

\`\`\`mermaid
graph TD
    A[Start] --> B{Is it working?}
    B -->|Yes| C[Great!]
    B -->|No| D[Debug more]
\`\`\`

End of test.`;
      setReply(testReply);
      replyRef.current = testReply;
      return;
    }
    
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
      
      console.log(`[Mermaid] Message ${message.id} is no longer active, processing mermaid diagrams`);
      // Process mermaid diagrams when the message is complete
      // Use a requestAnimationFrame to ensure DOM is fully updated
      requestAnimationFrame(() => {
        processMermaidDiagrams();
      });
    }
    
    return () => {
      if (reasoningInterval.current) {
        clearInterval(reasoningInterval.current);
        reasoningInterval.current = null;
      }
      setReasoningSeconds(0);
    };
  }, [message.isActive, processMermaidDiagrams]);

  // Process mermaid diagrams whenever the reply content changes
  useEffect(() => {
    if (reply && reply.includes('mermaid-placeholder')) {
      console.log(`[Mermaid] Reply contains mermaid-placeholder for message ${message.id}, processing...`);
      // Use requestAnimationFrame to ensure DOM is updated
      requestAnimationFrame(() => {
        processMermaidDiagrams();
      });
    }
  }, [reply, processMermaidDiagrams]);

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
    
    // Debug: Check if reply contains mermaid
    if (reply && reply.includes('```mermaid')) {
      console.log('[Mermaid] Reply contains mermaid code block:', reply);
    }
    
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
            {/* Display thinking phrase with transform reset */}
            <div style={{ 
              transform: 'none !important',
              transition: 'none !important',
              animation: 'none !important',
            }}>
              <ThinkingPhraseDisplay />
            </div>
            <div style={{ marginTop: '8px' }}>
              <span className="skeleton-box" style={{ width: '80%' }} />
            </div>
            <div style={{ marginTop: '4px' }}>
              <span className="skeleton-box" style={{ width: '90%' }} />
            </div>
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
                      __html: (() => {
                        const renderedHtml = render(
                          `${reasoning || ''}${isReasoning && reasoning ? '<span class="blinking-cursor" /></span>' : ''}`
                        );
                        return keyword && !renderedHtml.includes('mermaid-placeholder') 
                          ? highlight(renderedHtml, keyword) 
                          : renderedHtml;
                      })(),
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
                __html: (() => {
                  const renderedHtml = render(
                    `${reply || ''}${isLoading && reply ? '<span class="blinking-cursor" /></span>' : ''}`
                  );
                  return keyword && !renderedHtml.includes('mermaid-placeholder')
                    ? highlight(renderedHtml, keyword)
                    : renderedHtml;
                })(),
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
    t,
  ]);

  return (
    <div 
      className={`leading-6 message ${message.isActive ? 'streaming-active' : ''}`}
      id={message.id}
    >
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
              __html: (() => {
                const renderedHtml = render(message.prompt || '');
                return keyword && !renderedHtml.includes('mermaid-placeholder')
                  ? highlight(renderedHtml, keyword)
                  : renderedHtml;
              })(),
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
      <style>{`
        @keyframes subtleGlow {
          0% { box-shadow: 0 0 3px rgba(var(--shadow-color-rgb), 0.1); }
          50% { box-shadow: 0 0 10px rgba(var(--shadow-color-rgb), 0.3); }
          100% { box-shadow: 0 0 3px rgba(var(--shadow-color-rgb), 0.1); }
        }
        
        @keyframes fadeIn {
          0% { opacity: 0; transform: translateY(-5px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        
        /* Target .msg-reply descendant within .streaming-active */
        .streaming-active .msg-reply {
          animation: subtleGlow 1.8s ease-in-out infinite;
          border-radius: var(--borderRadiusMedium); /* Keep matching radius */
          /* Define shadow color variable - adjust RGB values as needed */
          /* Example: using a semi-transparent neutral color */
          --shadow-color-rgb: 100, 100, 100; 
        }

        /* Dark mode adjustment for shadow */
        .dark .streaming-active .msg-reply {
          --shadow-color-rgb: 180, 180, 180; 
        }
        
        /* Ensure blinking cursor is visible against pulsing background/glow */
        .streaming-active .blinking-cursor {
            background-color: var(--colorNeutralForeground1);
        }
        
        /* Override any transforms on thinking phrases */
        .omni-thinking-phrase {
          font-size: 0.875rem !important;
          color: #000000 !important; /* Black for light mode */
          font-style: italic !important;
          display: block !important;
          margin-bottom: 0.5rem !important;
          transform: none !important;
          transition: none !important;
          animation: none !important;
          position: static !important;
          opacity: 1 !important;
          visibility: visible !important;
          left: auto !important;
          top: auto !important;
          translate: none !important;
          rotate: none !important;
          scale: none !important;
        }

        /* Dark mode styling for thinking phrase */
        [data-theme='dark'] .omni-thinking-phrase {
          color: #ffffff !important; /* White for dark mode */
        }
        
        /* Ensure no parent transforms affect the thinking phrase */
        .msg-reply .omni-thinking-phrase,
        .msg-content .omni-thinking-phrase,
        .is-loading .omni-thinking-phrase {
          transform: none !important;
          transition: none !important;
          animation: none !important;
        }

      `}</style>
    </div>
  );
}
