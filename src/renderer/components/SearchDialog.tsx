/* eslint-disable react/no-danger */
import Debug from 'debug';
import Mousetrap from 'mousetrap';
import {
  Dialog,
  DialogSurface,
  DialogTitle,
  DialogContent,
  DialogTrigger,
  DialogBody,
  Button,
  Input,
  InputOnChangeData,
} from '@fluentui/react-components';
import { Dismiss24Regular, Search24Regular } from '@fluentui/react-icons';
import { ChangeEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { IChatMessage } from '../../intellichat/types';
import useNav from 'hooks/useNav';
import { debounce } from 'lodash';
import { useTranslation } from 'react-i18next';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const debug = Debug('OMNI-OS:components:SearchDialog');

interface ISearchResultItem {
  key: string;
  chatId: string;
  content: string;
}

const extractMatchedSnippet = (msgs: IChatMessage[], keywords: string[]) => {
  const radius = 50;
  const extract = (text: string, words: string[]) => {
    if (!text) return ''; // Skip if text is empty or undefined
    
    // Convert text and words to lowercase for case-insensitive matching
    const lowerText = text.toLowerCase();
    const lowerWords = words.map(word => word.trim().toLowerCase()).filter(w => w !== '');
    
    if (lowerWords.length === 0) return '';
    
    // Find all occurrences of all words
    const allMatches = [];
    for (const word of lowerWords) {
      let pos = 0;
      while (pos < lowerText.length) {
        const foundPos = lowerText.indexOf(word, pos);
        if (foundPos === -1) break;
        
        allMatches.push({
          word,
          pos: foundPos,
          left: Math.max(foundPos - radius, 0),
          right: foundPos + word.length + radius,
          originalWord: word // Keep the original word for highlighting
        });
        
        pos = foundPos + word.length;
      }
    }
    
    // If no matches found, return empty string
    if (allMatches.length === 0) return '';
    
    // Sort by position
    allMatches.sort((a, b) => a.pos - b.pos);
    
    // Merge overlapping snippets
    const mergedSegments = [];
    let currentSegment = allMatches[0];
    
    for (let i = 1; i < allMatches.length; i++) {
      const nextSegment = allMatches[i];
      
      // If segments overlap, merge them
      if (nextSegment.left <= currentSegment.right) {
        currentSegment.right = Math.max(currentSegment.right, nextSegment.right);
      } else {
        // No overlap, add current segment to results and start a new one
        mergedSegments.push(currentSegment);
        currentSegment = nextSegment;
      }
    }
    
    // Add the last segment
    mergedSegments.push(currentSegment);
    
    // Extract snippets from each merged segment
    const snippets = mergedSegments.map(segment => {
      const start = segment.left;
      const end = Math.min(segment.right, text.length);
      let snippet = text.substring(start, end).replace(/\r?\n|\r/g, ' ');
      
      // Add ellipsis if we're not at the beginning/end of text
      if (start > 0) snippet = '...' + snippet;
      if (end < text.length) snippet = snippet + '...';
      
      return snippet;
    });
    
    // Join all snippets 
    let result = snippets.join(' ... ');
    
    // Highlight all words in the result
    for (const word of lowerWords) {
      // Use regex with word boundary when possible for better matching
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      if (regex.test(result)) {
        result = result.replace(regex, match => `<mark>${match}</mark>`);
      } else {
        // Fallback to simple replacement if word boundary doesn't match
        const regex = new RegExp(word, 'gi');
        result = result.replace(regex, match => `<mark>${match}</mark>`);
      }
    }
    
    return result;
  };
  
  const result: ISearchResultItem[] = [];
  const processedMessages = new Set(); // Track processed message IDs
  
  msgs.forEach((msg: IChatMessage) => {
    // Process prompt
    const promptSnippet = extract(msg.prompt, keywords);
    if (promptSnippet !== '') {
      const promptKey = `prompt-${msg.id}`;
      if (!processedMessages.has(promptKey)) {
        result.push({
          key: promptKey,
          content: promptSnippet,
          chatId: msg.chatId,
        });
        processedMessages.add(promptKey);
      }
    }
    
    // Process reply
    const replySnippet = extract(msg.reply, keywords);
    if (replySnippet !== '') {
      const replyKey = `reply-${msg.id}`;
      if (!processedMessages.has(replyKey)) {
        result.push({
          key: replyKey,
          content: replySnippet,
          chatId: msg.chatId,
        });
        processedMessages.add(replyKey);
      }
    }
  });
  
  return result;
};

export default function SearchDialog(args: {
  open: boolean;
  setOpen: (open: boolean) => void;
  chatId?: string;
}) {
  const { t } = useTranslation();
  const [keyword, setKeyword] = useState<string>('');
  const [messages, setMessages] = useState<ISearchResultItem[]>([]);
  const { open, setOpen, chatId } = args;
  const navigate = useNav();

  const singleChatSearch = !!chatId;

  useEffect(() => {
    if (open) {
      Mousetrap.bind('esc', () => setOpen(false));
      window.electron.ingestEvent([{ app: 'search' }]);
    }
    return () => {
      Mousetrap.unbind('esc');
    };
  }, [open, setOpen]);

  const search = useMemo(
    () =>
      debounce(
        async (filter: string) => {
          if (filter.trim() === '') {
            setMessages([]);
            return;
          }
          
          // Split into words and remove empty strings
          const keywords = filter.split(' ')
            .map(word => word.trim())
            .filter(word => word !== '');
            
          if (keywords.length === 0) {
            setMessages([]);
            return;
          }
          
          const whereStats: string[] = [];
          const params: string[] = [];
          
          // Build more precise query
          // Each keyword must appear in either prompt OR reply
          // This will return messages that contain ALL keywords (in prompt, reply, or both)
          keywords.forEach((word: string) => {
            if (word === '') return;
            
            const param = `%${word.trim()}%`;
            whereStats.push('(prompt LIKE ? OR reply LIKE ?)');
            params.push(param);
            params.push(param);
          });
          
          // Add chatId filter if searching in a single chat
          if (singleChatSearch && chatId) {
            whereStats.push('chatId = ?');
            params.push(chatId);
          }

          // Use DISTINCT to avoid duplicate messages
          const sql = `SELECT DISTINCT id, chatId, prompt, reply FROM messages
            WHERE ${whereStats.join(' AND ')}
            ORDER BY createdAt DESC
            LIMIT ${singleChatSearch ? 50 : 20}
          `;
          
          const $messages = (await window.electron.db.all(
            sql,
            params
          )) as IChatMessage[];
          
          const searchResult = extractMatchedSnippet($messages, keywords);
          setMessages(searchResult);
        },
        400,
        {
          leading: true,
          maxWait: 2000,
        }
      ),
    [singleChatSearch, chatId]
  );

  const onKeywordChange = (
    ev: ChangeEvent<HTMLInputElement>,
    data: InputOnChangeData
  ) => {
    setKeyword(data.value);
    search(data.value);
  };

  const jumpTo = useCallback(
    (chatId: string, key: string) => {
      // Extract the message ID from the key (remove "prompt-" or "reply-" prefix)
      const messageId = key.includes('-') ? key.split('-')[1] : key;
      navigate(`/chats/${chatId}/${messageId}`);
      setOpen(false);
    },
    [navigate, setOpen],
  );

  const handleOpenChange = useCallback((event: any, data: any) => {
    setOpen(data.open);
  }, [setOpen]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle
            action={
              <DialogTrigger action="close">
                <Button
                  onClick={() => setOpen(false)}
                  appearance="subtle"
                  aria-label="close"
                  icon={<Dismiss24Regular />}
                />
              </DialogTrigger>
            }
          >
            <Input
              contentBefore={<Search24Regular />}
              value={keyword}
              placeholder={t(singleChatSearch ? 'Search in current chat.' : 'Search in all chats.')}
              onChange={onKeywordChange}
              className="w-full"
            />
          </DialogTitle>
          <DialogContent>
            {messages.map((message) => (
              <Button
                key={message.key}
                onClick={() => jumpTo(message.chatId, message.key)}
                className="w-full flex my-1.5"
                style={{ justifyContent: 'flex-start' }}
                appearance="subtle"
              >
                <div
                  dangerouslySetInnerHTML={{ __html: message.content }}
                  className="text-left"
                />
              </Button>
            ))}
          </DialogContent>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
