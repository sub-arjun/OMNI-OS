import {
  IChatMessage,
  IChatResponseMessage,
  IPromptDef,
} from 'intellichat/types';
import { isArray, isNull } from 'lodash';
import useSettingsStore from '../stores/useSettingsStore';

// Add this near the top of the file, after imports
export const REPLICATE_API_KEY = ''; // Key for speech-to-text

/**
 * Enhances a system prompt using prompt engineering techniques via Replicate API
 * @param systemPrompt - The system prompt to enhance
 * @returns A promise that resolves to the enhanced system prompt
 */
export async function enhanceSystemPrompt(systemPrompt: string): Promise<string> {
  // Use the hardcoded key defined at the top of the file
  // const REPLICATE_API_KEY is globally available from line 10

  if (!REPLICATE_API_KEY) {
    console.warn('Replicate API key (hardcoded) is missing, skipping prompt enhancement.');
    return systemPrompt; // Return original prompt if key is missing
  }

  console.log('Enhancing system prompt via Replicate API...');

  try {
    const instruction = `Enhance the following system prompt for an AI assistant. Make it clearer, more concise, and more effective in guiding the AI's behavior. Focus on professional and helpful interactions. Original prompt: "${systemPrompt}" Enhanced prompt:`;

    // Use fetch directly as Replicate SDK might not be available in all contexts
    const response = await fetch('https://api.replicate.com/v1/models/meta/llama-4-scout-instruct/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${REPLICATE_API_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'wait' // Request synchronous completion if possible
      },
      body: JSON.stringify({
        input: {
          prompt: instruction,
          max_new_tokens: 128, // Keep it reasonably short
          temperature: 0.6,   // Use user-specified temp
          top_p: 1.0,         // Use user-specified top_p
          presence_penalty: 0, // Use user-specified presence_penalty
          frequency_penalty: 0 // Use user-specified frequency_penalty
        }
      })
    });

    if (!response.ok) {
      console.error(`API call failed with status ${response.status}`);
      throw new Error(`API call failed with status ${response.status}`);
    }

    const initialData = await response.json();
    console.log('Replicate API initial response:', initialData);
    
    if (initialData.error) {
      console.error(`API error: ${initialData.error}`);
      throw new Error(`API error: ${initialData.error}`);
    }

    // If the response is still processing, wait for it to complete
    if (initialData.status === 'processing') {
      return await pollForEnhancedPrompt(initialData.id);
    }
    
    // Process and clean up the output
    let enhancedPrompt = initialData.output || systemPrompt;
    
    // If output is an array, join it with newlines
    if (Array.isArray(enhancedPrompt)) {
      enhancedPrompt = enhancedPrompt.join('');
    }
    
    // Skip text cleanup entirely - just return the raw response
    return enhancedPrompt;
  } catch (error) {
    console.error('Failed to enhance system prompt:', error);
    throw error;
  }
}

// Helper function to poll for the enhanced prompt result
async function pollForEnhancedPrompt(predictionId: string): Promise<string> {
  const maxAttempts = 30; // Maximum polling attempts
  const delay = 1000; // Delay between polls in ms
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      // Wait before polling
      await new Promise(resolve => setTimeout(resolve, delay));
      
      // Use the correct URL format for the Llama 3 model predictions
      const response = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
        headers: {
          'Authorization': `Bearer ${REPLICATE_API_KEY}`,
          'Content-Type': 'application/json'
        }
      });
      
      const data = await response.json();
      
      if (data.status === 'succeeded') {
        // Process and clean up the output
        let enhancedPrompt = data.output || '';
        
        // If output is an array, join it with simple concatenation
        if (Array.isArray(enhancedPrompt)) {
          enhancedPrompt = enhancedPrompt.join('');
        }
        
        // Skip cleanup entirely - return raw response
        return enhancedPrompt;
      } else if (data.status === 'failed') {
        throw new Error(`Prompt enhancement failed: ${data.error}`);
      }
      // Continue polling if still processing
    } catch (error) {
      console.error('Error polling for enhanced prompt:', error);
      throw error;
    }
  }
  
  throw new Error('Prompt enhancement timed out');
}

/**
 * Cleans up text from the API to remove formatting issues
 */
function cleanupPromptText(text: string): string {
  if (!text) return '';
  
  // Remove repeated commas
  text = text.replace(/,\s*,+/g, ',');
  
  // Remove extra spaces after commas
  text = text.replace(/,\s{2,}/g, ', ');
  
  // Fix common formatting issues with LLM responses
  text = text.replace(/^(?:Enhanced prompt:|Here is the enhanced system prompt:|Enhanced system prompt:)/i, '').trim();
  
  // If the response starts with quotes, remove them
  text = text.replace(/^["'](.+)["']$/s, '$1');
  
  // Remove trailing punctuation if it looks like the model added it
  text = text.replace(/[.!]\s*$/g, '');
  
  // First check if this is a run-together text issue
  // Count the average word length - if it's very high, we likely have run-together words
  const words = text.split(/\s+/);
  const avgWordLength = words.reduce((sum, word) => sum + word.length, 0) / (words.length || 1);
  
  // If average word length is very high (> 10), we likely have run-together words
  if (avgWordLength > 10) {
    text = separateRunTogetherWords(text);
  }
  
  // Fix camelCase or PascalCase words that should be separate words
  // Look for lowercase followed by uppercase or numbers followed by uppercase
  text = text.replace(/([a-z])([A-Z])/g, '$1 $2');
  text = text.replace(/([0-9])([A-Z])/g, '$1 $2');
  
  // Also break up words where lowercase letters follow uppercase (e.g., "YOUare" -> "YOU are")
  text = text.replace(/([A-Z])([A-Z][a-z])/g, '$1 $2');
  
  // Break up adjacent words that form clear dictionary words
  // This is a heuristic approach that splits at common word boundaries
  const commonPrefixes = ['and', 'or', 'the', 'with', 'to', 'in', 'on', 'for', 'of', 'a'];
  for (const prefix of commonPrefixes) {
    const regex = new RegExp(`(${prefix})([a-z][a-z][a-z]+)`, 'gi');
    text = text.replace(regex, '$1 $2');
  }
  
  // For longer run-on sequences, try a different approach
  // Look for patterns where part of a word could be its own word
  // For example: "expertisein" -> expertise + in
  text = text.replace(/([a-z]{5,})([a-z]{2,3})\b/g, (match, p1, p2) => {
    // Only split if p2 is a common short word
    if (['in', 'on', 'at', 'by', 'to', 'of', 'and', 'or', 'the', 'for'].includes(p2.toLowerCase())) {
      return `${p1} ${p2}`;
    }
    return match;
  });
  
  // Extreme spacing fix for cases with spaces between individual characters
  // Check if we have an extreme spacing issue (more spaces than half the characters)
  const spaceCount = (text.match(/ /g) || []).length;
  const charCount = text.replace(/ /g, '').length;
  
  if (spaceCount > charCount * 0.4) { // Threshold to detect extreme spacing
    // Step 1: Join single letters that are likely words (a, I, etc.)
    let words = text.split(/\s+/);
    let fixedWords = [];
    let currentWord = '';
    
    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      if (word.length === 1 && /[a-zA-Z]/.test(word)) {
        // Found a single letter - check if next words are also single letters
        currentWord = word;
        
        // Look ahead to collect consecutive single letters
        while (i + 1 < words.length && words[i + 1].length === 1 && /[a-zA-Z]/.test(words[i + 1])) {
          currentWord += words[i + 1];
          i++; // Skip the next word since we've incorporated it
        }
        
        fixedWords.push(currentWord);
      } else {
        // Regular word
        fixedWords.push(word);
      }
    }
    
    // Step 2: Apply regex to fix remaining cases of single-character separation
    text = fixedWords.join(' ');
    
    // Fix patterns like "w o r d" -> "word"
    text = text.replace(/\b([a-zA-Z]) ([a-zA-Z]) ([a-zA-Z]) ([a-zA-Z])\b/g, '$1$2$3$4');
    text = text.replace(/\b([a-zA-Z]) ([a-zA-Z]) ([a-zA-Z])\b/g, '$1$2$3');
    text = text.replace(/\b([a-zA-Z]) ([a-zA-Z])\b/g, '$1$2');
    
    // For longer words with spaces between all characters
    const spacedWordPattern = /(?:\b[a-zA-Z](?: [a-zA-Z]){2,}\b)/g;
    text = text.replace(spacedWordPattern, match => match.replace(/ /g, ''));
  }
  
  // Fix irregular spacing between single characters (spaces between almost every letter)
  text = text.replace(/(\w) (\w)/g, '$1$2');
  
  // Normalize multiple spaces into single spaces
  text = text.replace(/ +/g, ' ');
  
  // Fix line breaks - normalize to standard line breaks
  text = text.replace(/\r\n|\r/g, '\n');
  
  // Remove excessive empty lines (more than two consecutive line breaks)
  text = text.replace(/\n{3,}/g, '\n\n');
  
  return text;
}

// Helper function to separate run-together words using common words as landmarks
function separateRunTogetherWords(text: string): string {
  // Common words to use as landmarks for separation
  const commonWords = [
    // Common short words
    'a', 'an', 'the', 'and', 'or', 'but', 'nor', 'for', 'yet', 'so',
    'in', 'on', 'at', 'by', 'to', 'of', 'with', 'from', 'into',
    // Common medium words
    'when', 'where', 'what', 'which', 'who', 'whom', 'whose', 'why', 'how',
    'that', 'this', 'these', 'those', 'such', 'some', 'many', 'most', 'few',
    'provide', 'include', 'ensure', 'suggest', 'offer', 'first', 'then', 'also',
    // Common longer words that might appear in system prompts
    'information', 'guidelines', 'instructions', 'recommend', 'alternative',
    'appropriate', 'specific', 'different', 'important', 'necessary',
    'expertise', 'techniques', 'experience', 'knowledge', 'understanding'
  ];
  
  let result = text;
  
  // Sort words by length (longest first) to avoid subword matching issues
  commonWords.sort((a, b) => b.length - a.length);
  
  // For each word in our list
  for (const word of commonWords) {
    // Create a regex that finds the word within other text, case insensitive
    // Match only if preceded by at least 2 letters and/or followed by at least 2 letters
    const regex = new RegExp(`([a-z]{2,})(${word})([a-z]{2,})`, 'gi');
    result = result.replace(regex, `$1 ${word} $3`);
    
    // Also check for word at the beginning of a longer word
    const beginRegex = new RegExp(`\\b(${word})([a-z]{3,})`, 'gi');
    result = result.replace(beginRegex, `${word} $2`);
    
    // And check for word at the end of a longer word
    const endRegex = new RegExp(`([a-z]{3,})(${word})\\b`, 'gi');
    result = result.replace(endRegex, `$1 ${word}`);
  }
  
  return result;
}

export function date2unix(date: Date) {
  return Math.floor(date.getTime() / 1000);
}

export function unix2date(unix: number) {
  return new Date(unix * 1000);
}

export function isTagClosed(code: string, tag: string) {
  if (!code || code.trim() === '') return true;
  if (!tag || tag.trim() === '') return true;
  const openRegex = new RegExp(`<${tag}>`, 'g');
  const closeRegex = new RegExp(`</${tag}>`, 'g');
  const openMatched = code.match(openRegex) || [];
  const closeMatched = code.match(closeRegex) || [];
  return openMatched.length === closeMatched.length;
}

export function str2int(str: string, defaultValue: number | null = null) {
  const result = parseInt(str, 10);
  if (Number.isNaN(result)) {
    return defaultValue;
  }
  return result;
}

export function fmtDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}/${month}/${day}`;
}

export function fmtDateTime(date: Date) {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${fmtDate(date)} ${hours}:${minutes}:${seconds}`;
}

export function highlight(text: string, keyword: string | string[]) {
  if (!text) return '';
  if (!keyword) return text;
  if (typeof keyword === 'string') {
    if (keyword.trim() === '') return text;
    const regex = new RegExp(keyword.trim(), 'gi');
    return text.replace(regex, (match) => `<mark class="highlight-match">${match}</mark>`);
  }
  let result = text;
  keyword.forEach((word) => {
    const regex = new RegExp(word, 'gi');
    result = result.replace(regex, (match) => `<mark class="highlight-match">${match}</mark>`);
  });
  return result;
}

export function parseVariables(text: string): string[] {
  const regex = /\{\{([^}]+)\}\}/g;
  const variables: string[] = [];
  let m = regex.exec(text);
  while (m) {
    const variable = m[1].trim();
    if (variable !== '' && !variables.includes(variable)) {
      variables.push(variable);
    }
    variables.push();
    m = regex.exec(text);
  }
  return variables;
}

export function fillVariables(
  text: string,
  variables: { [key: string]: string },
) {
  let result = text;
  Object.keys(variables).forEach((key) => {
    const regex = new RegExp(`{{${key}}}`, 'g');
    result = result.replace(regex, variables[key]);
  });
  return result;
}
export function sortPrompts(prompts: IPromptDef[]) {
  if (!isArray || prompts.length === 0) {
    return [];
  }
  return prompts.sort((a: IPromptDef, b: IPromptDef) => {
    if (isNull(a.pinedAt) && isNull(b.pinedAt)) {
      return a.createdAt - b.createdAt;
    }
    if (a.pinedAt && isNull(b.pinedAt)) {
      return -1 || a.createdAt - b.createdAt;
    }
    if (b.pinedAt && isNull(a.pinedAt)) {
      return 1 || a.createdAt - b.createdAt;
    }
    return (
      (b.pinedAt as number) - (a.pinedAt as number) || a.createdAt - b.createdAt
    );
  });
}

export function insertAtCursor(field: HTMLDivElement, value: string) {
  field.focus();
  const selection = window.getSelection();
  if (selection && selection.rangeCount > 0) {
    const range = selection.getRangeAt(0);
    const node = document.createRange().createContextualFragment(value);
    const lastNode = node.lastChild;
    range.insertNode(node);
    if (lastNode) {
      range.setStartAfter(lastNode);
      range.setEndAfter(lastNode);
      selection.removeAllRanges();
      selection.addRange(range);
    }
  } else {
    field.innerText = field.innerHTML + value;
    setCursorToEnd(field);
  }
  return field.innerHTML;
}

export function setCursorToEnd(field: HTMLDivElement) {
  const range = document.createRange();
  const selection = window.getSelection();
  if (selection) {
    range.selectNodeContents(field);
    range.collapse(false); // false means collapse to end
    selection.removeAllRanges();
    selection.addRange(range);
  }
}

export function isGPT35(model: string) {
  return (
    model.toLowerCase().startsWith('gpt-3.5') ||
    model.toLowerCase().startsWith('gpt-35')
  );
}

export function isGPT4(model: string) {
  return model.toLowerCase().startsWith('gpt-4');
}

export function isGPT(model: string) {
  return isGPT35(model) || isGPT4(model);
}

export function isDoubao(model: string) {
  return model.toLowerCase().startsWith('doubao');
}

export function isGrok(model: string) {
  return model.toLowerCase().startsWith('grok');
}

export function isDeepSeek(model: string) {
  return model.toLowerCase().startsWith('deepseek');
}

export function isClaude1(model: string) {
  return model.toLowerCase() === 'claude-instant-1';
}

export function isClaude2(model: string) {
  return model.toLowerCase() === 'claude-2';
}

export function isClaude(model: string) {
  return isClaude1(model) || isClaude2(model);
}

export function isGemini(model: string) {
  return model.toLowerCase().startsWith('gemini');
}

export function isMoonshot(model: string) {
  return model.toLowerCase().startsWith('moonshot');
}

export function isLlama(model: string) {
  return model.toLowerCase().startsWith('llama');
}

export function tryAgain(callback: () => any, times = 3, delay = 1000) {
  let tryTimes = 0;
  const interval = setInterval(() => {
    tryTimes += 1;
    if (tryTimes > times) {
      clearInterval(interval);
    }
    try {
      if (callback()) {
        clearInterval(interval);
      }
    } catch (e) {
      console.log(e);
    }
  }, delay);
}

export function raiseError(status: number, response: any, message?: string) {
  /**
   * Azure will return resposne like follow
   * {
   *   "error": {
   *     "message": "...",
   *     "type": "invalid_request_error",
   *     "param": "messages",
   *     "code": "context_length_exceeded"
   *   }
   * }
   */
  const resp = Array.isArray(response) ? response[0] : response;
  const msg = resp?.error?.message || resp?.error || message;
  switch (status) {
    case 400:
      throw new Error(msg || 'Bad request');
    case 401:
      throw new Error(
        msg ||
          'Invalid authentication, please ensure the API key used is correct',
      );
    case 403:
      throw new Error(
        msg ||
          'Permission denied, please confirm your authority before try again.',
      );
    case 404:
      new Error(msg || 'Not found');
    case 409:
      new Error(msg || 'Conflict');
    case 429:
      new Error(
        msg ||
          'Rate limit reached for requests, or you exceeded your current quota.',
      );
    case 500:
      throw new Error(
        msg || 'The server had an error while processing your request',
      );
    case 503:
      throw new Error(
        msg || 'The engine is currently overloaded, please try again later',
      );
    default:
      throw new Error(msg || 'Unknown error');
  }
}

export function arrayBufferToBase64(buffer: ArrayBuffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

export async function getBase64(url: string): Promise<string> {
  const resp = await fetch(url);
  return arrayBufferToBase64(await resp.arrayBuffer());
}

export function removeTagsExceptImg(html: string): string {
  // 使用正则表达式移除除 <img> 以外的所有标签
  return html.replace(/<(?!img\b)[^>]*>/gi, '');
}

export function stripHtmlTags(html: string): string {
  return html.replace(/<[^>]*>/g, '');
}

export function splitByImg(html: string, base64Only: boolean = false) {
  const defaultMimeType = 'image/jpeg';
  const mimeTypes: { [key: string]: string } = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.bmp': 'image/bmp',
    '.webp': 'image/webp',
    '.heic': 'image/heic',
    '.heif': 'image/heif',
  };
  const splitRegex = base64Only
    ? /(<img\s+src="data:[^"]+"\s*.*\/?>)/g
    : /(<img\s+src="[^"]+"\s*.*\/?>)/g;
  const srcRegex = base64Only
    ? /<img\s+src="(data:[^"]+)"\s*.*\/?>/g
    : /<img\s+src="([^"]+)"\s*.*\/?>/g;
  const items = html
    .split(splitRegex)
    .map((item) => item.trim())
    .filter((item: string) => item !== '');
  return items.map((item: string) => {
    const matches = item.match(srcRegex);
    if (matches) {
      const data = matches.map((match) => match.replace(srcRegex, '$1'))[0];
      const dataType = data.startsWith('data:') ? 'base64' : 'URL';
      let mimeType = defaultMimeType;
      if (dataType === 'base64') {
        mimeType = data.split(';')[0].split(':')[1];
      } else {
        const ext = `.${data.split('.').pop()?.toLowerCase()}`;
        mimeType = ext ? mimeTypes[ext] || defaultMimeType : defaultMimeType;
      }
      return {
        type: 'image',
        dataType,
        mimeType,
        data,
      };
    }
    return {
      type: 'text',
      data: item,
    };
  });
}

export function paddingZero(num: number, length: number) {
  return (Array(length).join('0') + num).slice(-length);
}

export function fileSize(sizeInBytes: number) {
  const i = Math.floor(Math.log(sizeInBytes) / Math.log(1024));
  return (
    (sizeInBytes / 1024 ** i).toFixed(1) + ['B', 'KB', 'MB', 'GB', 'TB'][i]
  );
}

export function isOneDimensionalArray(arr: any[]): boolean {
  if (!isArray(arr)) {
    throw new Error('Input is not an array.');
  }
  for (const item of arr) {
    if (isArray(item)) {
      return false; // It is a two-dimensional array
    }
  }
  return true;
}

export function extractCitationIds(text: string): string[] {
  const regex = /\[\(?\d+\)?\]\(citation#([a-z0-9]+)\s*.*?\)/g;
  // 使用matchAll返回所有匹配结果
  const matches = text.matchAll(regex);
  return [...matches].map((match) => match[1]);
}

export function extractFirstLevelBrackets(text: string): string[] {
  const results = [];
  const stack = [];
  let current = '';
  let firstLevelCapture = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (char === '{') {
      if (stack.length === 0) {
        firstLevelCapture = true;
        current = ''; // start capturing a new section
      }
      stack.push('{');
    }

    if (firstLevelCapture) {
      current += char;
    }

    if (char === '}') {
      stack.pop();
      if (stack.length === 0) {
        firstLevelCapture = false;
        results.push(current); // end of a section
        current = ''; // reset current for the next possible section
      }
    }
  }

  return results;
}

export function getReasoningContent(reply: string, reasoning?: string) {
  // If a reasoning field is explicitly provided (from Anthropic or other providers), use that
  if (reasoning) {
    return reasoning;
  }
  
  // Check for embedded reasoning in JSON response format (Anthropic streaming format)
  try {
    // Try to parse potential JSON strings in the reply that might contain reasoning
    const reasoningMatches = reply.match(/"reasoning":"(.*?)"/g);
    if (reasoningMatches && reasoningMatches.length > 0) {
      // Extract and combine all reasoning chunks
      const extractedReasoning = reasoningMatches
        .map(match => {
          // Extract the reasoning content from the match
          const content = match.replace(/"reasoning":"/, '').slice(0, -1);
          // Unescape any escaped quotes in the content
          return content.replace(/\\"/g, '"');
        })
        .join(' ');
      return extractedReasoning;
    }
  } catch (error) {
    // If parsing fails, continue with the existing approach
    console.debug('Failed to parse reasoning from JSON', error);
  }
  
  // Check for reasoning in other JSON formats
  try {
    // Look for "thinking" field which might be used by some models
    const thinkingMatches = reply.match(/"thinking":"(.*?)"/g);
    if (thinkingMatches && thinkingMatches.length > 0) {
      const extractedThinking = thinkingMatches
        .map(match => {
          const content = match.replace(/"thinking":"/, '').slice(0, -1);
          return content.replace(/\\"/g, '"');
        })
        .join(' ');
      return extractedThinking;
    }
  } catch (error) {
    console.debug('Failed to parse thinking from JSON', error);
  }
  
  // Check for reasoning enclosed in <think> tags (original implementation)
  try {
    const parts = reply.split('<think>');

    if (parts.length > 1) {
      const thinkParts = parts
        .slice(1)
        .map((part) => {
          const [content] = part.split('</think>');
          return content;
        })
        .filter(Boolean);

      const joinedParts = thinkParts.join('');
      return joinedParts;
    }
  } catch (error) {
    console.debug('Failed to parse reasoning from think tags', error);
  }
  
  // Check for OpenRouter specific reasoning format
  try {
    // Sometimes OpenRouter might include reasoning in a specific format within the content
    const openRouterReasoningMatch = reply.match(/\[reasoning\](.*?)\[\/reasoning\]/s);
    if (openRouterReasoningMatch && openRouterReasoningMatch[1]) {
      return openRouterReasoningMatch[1].trim();
    }
  } catch (error) {
    console.debug('Failed to parse OpenRouter reasoning format', error);
  }

  return '';
}

export function getNormalContent(reply: string) {
  // First, remove any JSON reasoning data that might be in the response
  let cleanedReply = reply;
  try {
    // Remove reasoning JSON chunks from the reply
    cleanedReply = reply.replace(/"reasoning":".*?"/g, '');
  } catch (error) {
    // If replacement fails, continue with the original reply
    console.debug('Failed to clean reasoning JSON from reply', error);
  }
  
  // Then process <think> tags as before
  const parts = cleanedReply.split('<think>');

  if (parts.length === 1) {
    return cleanedReply;
  }

  const replyParts = parts
    .map((part) => part.split('</think>')[1])
    .filter(Boolean);

  return replyParts.join('');
}

export function urlJoin(part: string, base: string): URL {
  // Trim trailing slash from base
  const trimmedBase = base.replace(/\/+$/, '');
  
  // Remove leading slash from part and trim trailing slashes
  const trimmedPart = part.replace(/^\/+/, '');
  
  // Join with a single slash
  return new URL(`${trimmedBase}/${trimmedPart}`);
}

/**
 * Converts Markdown text to plain text by removing common Markdown syntax
 * while preserving punctuation for text-to-speech
 */
export function markdownToPlainText(markdown: string): string {
  if (!markdown) return '';
  
  let plainText = markdown;
  
  // Remove code blocks
  plainText = plainText.replace(/```[\s\S]*?```/g, '');
  
  // Remove inline code but preserve punctuation
  plainText = plainText.replace(/`([^`]+)`/g, '$1');
  
  // Remove headers but preserve punctuation
  plainText = plainText.replace(/^#{1,6}\s+(.+)$/gm, '$1');
  
  // Remove bold and italic but preserve punctuation
  plainText = plainText.replace(/\*\*\*(.*?)\*\*\*/g, '$1');
  plainText = plainText.replace(/\*\*(.*?)\*\*/g, '$1');
  plainText = plainText.replace(/\*(.*?)\*/g, '$1');
  plainText = plainText.replace(/_{3}(.*?)_{3}/g, '$1');
  plainText = plainText.replace(/_{2}(.*?)_{2}/g, '$1');
  plainText = plainText.replace(/_(.*?)_/g, '$1');
  
  // Remove links but keep the text and any trailing punctuation
  plainText = plainText.replace(/\[([^\]]+)\](?:\([^)]+\))([.,!?;:])?/g, '$1$2');
  
  // Remove image syntax
  plainText = plainText.replace(/!\[([^\]]*)\]\([^)]+\)/g, '');
  
  // Convert bullet points to simple text (preserving punctuation)
  plainText = plainText.replace(/^\s*[-*+]\s+(.+)$/gm, '• $1');
  
  // Convert numbered lists to simple text (preserving punctuation)
  plainText = plainText.replace(/^\s*\d+\.\s+(.+)$/gm, '$1');
  
  // Remove blockquotes but preserve punctuation
  plainText = plainText.replace(/^\s*>\s+(.+)$/gm, '$1');
  
  // Remove horizontal rules
  plainText = plainText.replace(/^\s*[-*_]{3,}\s*$/gm, '');
  
  // Remove HTML tags but preserve punctuation
  plainText = plainText.replace(/<[^>]*>([.,!?;:]*)/g, '$1');
  
  // Fix multiple consecutive spaces (be careful not to remove spaces after punctuation)
  plainText = plainText.replace(/([^.,!?;:])\s{2,}/g, '$1 ');
  
  // Ensure spaces after punctuation
  plainText = plainText.replace(/([.,!?;:])([a-zA-Z])/g, '$1 $2');
  
  // Fix multiple consecutive line breaks
  plainText = plainText.replace(/\n{2,}/g, '\n');
  
  return plainText.trim();
}

export async function textToSpeech(markdown: string): Promise<string> {
  // Check if current provider is Ollama (OMNI Edge maps to Ollama internally)
  const api = useSettingsStore.getState().api;
  if (api?.provider === 'Ollama') { // Simplified check
    throw new Error('Text-to-speech is not supported with OMNI Edge/Ollama');
  }

  // Convert markdown to plain text
  const text = markdown
    .replace(/```[\s\S]*?```/g, '')  // Remove code blocks
    .replace(/`([^`]+)`/g, '$1')     // Remove inline code
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')  // Replace links with just the text
    .replace(/#+\s(.*)/g, '$1')      // Remove heading markers
    .replace(/(\*\*|__)(.*?)\1/g, '$2')  // Remove bold
    .replace(/(\*|_)(.*?)\1/g, '$2') // Remove italic
    .replace(/\n+/g, ' ')            // Replace newlines with spaces
    .replace(/\s+/g, ' ')            // Replace multiple spaces with single space
    .trim();                          // Trim spaces from start and end
    
  if (!text) {
    throw new Error('Cannot convert empty text to speech');
  }

  // Ensure window.electron exists and has the required methods
  if (typeof window.electron?.proxyReplicate !== 'function' || typeof window.electron?.fetchAudioData !== 'function') {
    console.error('window.electron API (proxyReplicate or fetchAudioData) is not available. Check preload script.');
    throw new Error('Electron context API is not available');
  }

  try {
    console.log('Requesting TTS from Replicate API...');
    const initialData = await window.electron.proxyReplicate({
      url: 'https://api.replicate.com/v1/predictions',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${REPLICATE_API_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'wait'
      },
      body: JSON.stringify({
        version: "f559560eb822dc509045f3921a1921234918b91739db4bf3daab2169b71c7a13",
        input: {
          text: text,
          speed: 1,
          voice: "af_bella" // Example voice
        }
      })
    });
    
    console.log('Replicate TTS initial response:', initialData);
    
    if (initialData.error) {
      throw new Error(`Replicate API error: ${initialData.error}`);
    }
    
    const predictionId = initialData.id;
    if (!predictionId || typeof predictionId !== 'string') {
      throw new Error('Failed to get prediction ID from initial Replicate response');
    }
    
    let remoteUrl;
    if (initialData.status === 'processing' || initialData.status === 'starting') {
      console.log('TTS prediction is processing, polling for result...');
      remoteUrl = await pollForTtsResult(predictionId);
    } else if (initialData.status === 'succeeded') {
      remoteUrl = initialData.output;
    } else {
      throw new Error(`TTS prediction failed with status: ${initialData.status}, error: ${initialData.error}`);
    }
    
    if (!remoteUrl || typeof remoteUrl !== 'string') {
      throw new Error('Failed to get audio URL from Replicate API response');
    }
    
    // Use the newly exposed IPC handler to fetch audio via the main process
    console.log('Fetching audio data via main process from:', remoteUrl);
    const audioDataUrl = await window.electron.fetchAudioData(remoteUrl);
    console.log('Audio data URL received from main process.');
    
    // Return the base64 data URL received from the main process
    return audioDataUrl;

  } catch (error) {
    console.error('Error in textToSpeech function:', error);
    throw error; // Re-throw the error for the caller to handle
  }
}

// Helper function to poll for TTS result
async function pollForTtsResult(predictionId: string): Promise<string> {
  const maxAttempts = 30;
  const delay = 1000;
  
  console.log(`Starting polling for TTS prediction: ${predictionId}`);
  
  // Ensure window.electron exists and has the required method
  if (typeof window.electron?.proxyReplicate !== 'function') {
    console.error('window.electron.proxyReplicate is not available for polling. Check preload script.');
    throw new Error('Electron context (proxyReplicate) is not available for polling');
  }
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      await new Promise(resolve => setTimeout(resolve, delay));
      
      console.log(`Polling attempt ${attempt + 1}/${maxAttempts} for prediction ${predictionId}...`);
      
      // Explicitly assert window.electron exists here after the check above
      const data = await window.electron!.proxyReplicate({
         url: `https://api.replicate.com/v1/predictions/${predictionId}`,
         method: 'GET',
         headers: {
           'Authorization': `Bearer ${REPLICATE_API_KEY}`,
           'Content-Type': 'application/json'
         }
      });
      
      console.log(`Polling response for attempt ${attempt + 1}:`, JSON.stringify(data, null, 2));
      
      if (data.status === 'succeeded') {
        console.log('Polling succeeded, returning output URL');
        if (!data.output || typeof data.output !== 'string') {
          throw new Error('Polling succeeded but received invalid output URL');
        }
        return data.output;
      } else if (data.status === 'failed') {
        console.error('TTS prediction failed with error:', data.error);
        throw new Error(`TTS generation failed: ${data.error || 'Unknown error'}`);
      } else if (data.status === 'canceled') {
        console.log('TTS prediction was canceled');
        throw new Error('TTS operation was canceled');
      } else {
        console.log(`Polling status: ${data.status}, continuing to poll...`);
      }
    } catch (error: any) {
      console.error(`Error during polling attempt ${attempt + 1}:`, error);
      if (error.message.includes('Authentication error')) {
         throw error;
      }
      if (attempt === maxAttempts - 1) {
        throw new Error(`Polling failed after ${maxAttempts} attempts: ${error.message}`);
      }
    }
  }
  
  throw new Error(`TTS generation timed out after ${maxAttempts} attempts`);
}

// Speech to text functionality
export async function speechToText(audioBase64: string, signal?: AbortSignal): Promise<string> {
  try {
    // Set global flag to indicate active processing
    window._activeSpeechProcessing = true;
    window._lastProcessingStartTime = Date.now();
    
    console.log('Starting speech-to-text processing...');
    
    // Check if current provider is Ollama (OMNI Edge maps to Ollama internally)
    const api = useSettingsStore.getState().api;
    if (api?.provider === 'Ollama') { // Simplified check
      throw new Error('Speech-to-text is not supported with OMNI Edge/Ollama');
    }

    // Validate audioBase64 input
    if (!audioBase64 || typeof audioBase64 !== 'string') {
      console.error('Invalid audio data provided to speechToText:', typeof audioBase64);
      throw new Error('Invalid audio data provided');
    }
    
    console.log(`Audio base64 length: ${audioBase64.length} characters`);
    if (audioBase64.length < 1000) {
      console.error('Audio recording too short:', audioBase64.length);
      throw new Error('Audio recording too short or empty');
    }

    try {
      // Create a data URL from the base64 audio - ensure we're not doubling up on the data URL prefix
      const audioUrl = audioBase64.startsWith('data:audio') 
        ? audioBase64 
        : `data:audio/wav;base64,${audioBase64}`;
      
      console.log('Sending request to Replicate API...');
      console.log('Using API key:', REPLICATE_API_KEY ? `${REPLICATE_API_KEY.substring(0, 4)}...` : 'Missing key');
      
      // Use electron proxy instead of direct fetch
      const data = await window.electron.proxyReplicate({
        url: 'https://api.replicate.com/v1/predictions',
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${REPLICATE_API_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'wait'
        },
        body: JSON.stringify({
          version: "3ab86df6c8f54c11309d4d1f930ac292bad43ace52d10c80d87eb258b3c9f79c",
          input: {
            task: "transcribe",
            audio: audioUrl,
            language: "None", // Changed from "en" to "None" as required by the API
            timestamp: "chunk",
            batch_size: 64,
            diarise_audio: false
          }
        })
      });
      
      console.log('Replicate API response:', data);
      
      if (data.error) {
        console.error('API returned error:', data.error);
        throw new Error(`API error: ${data.error}`);
      }
      
      // If prediction is still processing, poll for result
      let output;
      if (data.status === 'processing' || data.status === 'starting') {
        console.log('Request is still processing, polling for result...');
        output = await pollForSttResult(data.id, signal);
      } else {
        output = data.output;
      }
      
      // Parse and return the transcribed text
      console.log('Extracting text from response:', output);
      const text = extractTextFromSttResponse(output);
      console.log('Extracted text:', text);
      
      // Additional validation to prevent empty results
      if (!text || typeof text !== 'string' || text.trim() === '') {
        console.error('No text detected in response');
        throw new Error('No speech detected or transcription failed');
      }
      
      // Clear processing flag on success
      window._activeSpeechProcessing = false;
      return text;
    } catch (error: any) {
      // Clear processing flag on error
      window._activeSpeechProcessing = false;
      
      // Re-throw AbortError to be caught by the caller
      if (error.name === 'AbortError') {
        console.log('STT operation aborted by user');
        throw error;
      }
      
      console.error('Error in speech-to-text:', error);
      throw new Error(error.message || 'Failed to transcribe audio');
    }
  } catch (error: any) {
    // Clear processing flag on any error
    window._activeSpeechProcessing = false;
    
    console.error('Speech to text conversion failed:', error);
    throw error;
  }
}

// Helper function to poll for STT result
async function pollForSttResult(predictionId: string, signal?: AbortSignal): Promise<any> {
  const maxAttempts = 30; // Maximum polling attempts
  const delay = 1000; // Delay between polls in ms
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      // Check if the operation was aborted
      if (signal?.aborted) {
        throw new DOMException('STT operation aborted by user', 'AbortError');
      }
      
      // Wait before polling
      await new Promise(resolve => setTimeout(resolve, delay));
      
      // Check again after delay if the operation was aborted
      if (signal?.aborted) {
        throw new DOMException('STT operation aborted by user', 'AbortError');
      }
      
      console.log(`Polling attempt ${attempt + 1}/${maxAttempts} for prediction ${predictionId}`);
      
      // Use electron proxy instead of direct fetch
      const data = await window.electron.proxyReplicate({
        url: `https://api.replicate.com/v1/predictions/${predictionId}`,
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${REPLICATE_API_KEY}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log(`Polling response for attempt ${attempt + 1}:`, JSON.stringify(data, null, 2));
      
      if (data.status === 'succeeded') {
        console.log('Polling succeeded, returning output');
        return data.output;
      } else if (data.status === 'failed') {
        // Clear global processing flag
        window._activeSpeechProcessing = false;
        console.error('STT prediction failed with error:', data.error);
        throw new Error(`STT generation failed: ${data.error || 'Unknown error'}`);
      } else if (data.status === 'canceled') {
        // Clear global processing flag
        window._activeSpeechProcessing = false;
        console.log('STT prediction was canceled');
        throw new Error('STT operation was canceled');
      } else {
        console.log(`Polling status: ${data.status}, continuing to poll...`);
      }
      // Continue polling if still processing
    } catch (error: any) {
      // Clear global processing flag on error
      window._activeSpeechProcessing = false;
      
      // If this is an abort error, propagate it
      if (error.name === 'AbortError') {
        console.log('Polling aborted by user');
        throw error;
      }
      
      // If we get an HTTP error with specific status codes, handle them
      if (error.message && error.message.includes('status:')) {
        const statusMatch = error.message.match(/status: (\d+)/);
        if (statusMatch && statusMatch[1]) {
          const status = parseInt(statusMatch[1]);
          
          // Handle specific status codes
          if (status === 401 || status === 403) {
            console.error('Authentication error with Replicate API - invalid or expired token');
            throw new Error('Authentication error: Invalid or expired Replicate API token');
          } else if (status === 404) {
            console.error('Prediction not found - ID may be invalid:', predictionId);
            throw new Error('Prediction not found');
          } else if (status === 422) {
            console.error('Validation error with request parameters');
            throw new Error('Invalid request parameters');
          } else if (status >= 500) {
            console.error('Replicate server error:', error.message);
            throw new Error('Replicate service unavailable. Try again later.');
          }
        }
      }
      
      console.error('Error polling for STT result:', error);
      throw error;
    }
  }
  
  // Clear global processing flag on timeout
  window._activeSpeechProcessing = false;
  throw new Error('STT generation timed out');
}

// Helper function to extract text from the API response
function extractTextFromSttResponse(output: any): string {
  try {
    console.log('extractTextFromSttResponse: Processing output type:', typeof output, output);
    
    // If output is a string, try to parse it as JSON
    if (typeof output === 'string') {
      try {
        const parsedOutput = JSON.parse(output);
        // Check if it has the expected structure
        if (parsedOutput.text) {
          return parsedOutput.text;
        }
      } catch (e) {
        // If parsing fails, return the string as is
        return output;
      }
    }
    
    // Check for transcription field (Whisper specific format)
    if (output && typeof output === 'object' && output.transcription) {
      console.log('extractTextFromSttResponse: Found transcription field:', output.transcription);
      return output.transcription;
    }
    
    // If output is already an object with text property
    if (output && typeof output === 'object' && output.text) {
      console.log('extractTextFromSttResponse: Found text field:', output.text);
      return output.text;
    }
    
    // If output has chunks array
    if (output && Array.isArray(output.chunks) && output.chunks.length > 0) {
      // Concatenate all chunk texts
      return output.chunks.map((chunk: any) => chunk.text).join(' ');
    }
    
    // If output is an array of chunks
    if (Array.isArray(output)) {
      if (output.length > 0 && output[0].text) {
        // Array of chunks with text property
        return output.map((chunk: any) => chunk.text).join(' ');
      } else {
        // Simple array of strings
        return output.join(' ');
      }
    }
    
    // Fallback: stringify the output
    console.log('extractTextFromSttResponse: Falling back to string conversion');
    return String(output || '');
  } catch (e) {
    console.error('Error extracting text from STT response:', e);
    return String(output || '');
  }
}

// Audio recording functionality
export class AudioRecorder {
  private stream: MediaStream | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private onDataAvailableCallback: ((data: Blob) => void) | null = null;
  private onStopCallback: ((audioBlob: Blob) => void) | null = null;
  private isCleanedUp: boolean = false;

  constructor() {
    console.log('AudioRecorder constructor called');
  }

  getStream(): MediaStream | null {
    return this.stream;
  }

  async start(): Promise<void> {
    try {
      console.log('AudioRecorder.start() called');
      
      // Ensure we clean up previous stream if start is called multiple times
      await this.cleanup();
      
      // Get microphone access
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      console.log('Microphone access granted');
      
      // Create MediaRecorder with specific settings for better audio quality
      this.mediaRecorder = new MediaRecorder(this.stream, {
        mimeType: 'audio/webm;codecs=opus',
        audioBitsPerSecond: 128000
      });
      console.log('MediaRecorder created', this.mediaRecorder.state);
      
      this.audioChunks = [];
      this.isCleanedUp = false;
      
      // Add data available event listener
      this.mediaRecorder.addEventListener('dataavailable', (event) => {
        if (event.data.size > 0) {
          console.log(`AudioRecorder: dataavailable event, size=${event.data.size}`);
          this.audioChunks.push(event.data);
          
          if (this.onDataAvailableCallback) {
            this.onDataAvailableCallback(event.data);
          }
        }
      });
      
      // Add stop event listener with explicit log messages
      this.mediaRecorder.addEventListener('stop', () => {
        console.log('AudioRecorder: MediaRecorder STOP event fired');
        console.log(`AudioRecorder: ${this.audioChunks.length} chunks collected`);
        
        if (this.audioChunks.length > 0) {
          const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
          console.log(`AudioRecorder: Created blob of ${audioBlob.size} bytes`);
          
          if (this.onStopCallback) {
            console.log('AudioRecorder: Calling onStop callback');
            // Use setTimeout to avoid any potential issues with event loop
            window.setTimeout(() => {
              if (this.onStopCallback) {
                console.log('AudioRecorder: Executing onStop callback');
                try {
                  this.onStopCallback(audioBlob);
                  console.log('AudioRecorder: onStop callback completed');
                } catch (err) {
                  console.error('AudioRecorder: Error in onStop callback:', err);
                }
              }
            }, 10);
          } else {
            console.warn('AudioRecorder: No onStop callback registered');
          }
        } else {
          console.warn('AudioRecorder: No audio chunks available after recording');
        }
        
        console.log('AudioRecorder: Cleaning up resources after stop event');
        this.releaseMediaResources();
      });
      
      // Start recording with time slices to get data more frequently
      this.mediaRecorder.start(100);
      console.log('AudioRecorder: Recording started with 100ms time slices');
    } catch (error) {
      console.error('AudioRecorder: Error starting recording:', error);
      await this.cleanup();
      throw error;
    }
  }
  
  stop(): void {
    console.log('AudioRecorder.stop() called');
    
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      console.log(`AudioRecorder: Current state before stop: ${this.mediaRecorder.state}`);
      console.log(`AudioRecorder: ${this.audioChunks.length} chunks collected so far`);
      
      try {
        console.log('AudioRecorder: Stopping MediaRecorder...');
        this.mediaRecorder.stop();
        console.log('AudioRecorder: MediaRecorder.stop() called successfully');
      } catch (err) {
        console.error('AudioRecorder: Error stopping MediaRecorder:', err);
        // Force resource cleanup even if stop fails
        this.releaseMediaResources();
      }
    } else {
      console.log(`AudioRecorder: MediaRecorder can't be stopped. State: ${this.mediaRecorder?.state || 'null'}`);
      // If mediaRecorder isn't recording, still ensure resources are cleared
      this.releaseMediaResources();
    }
  }
  
  // Release media resources while preserving callbacks
  private releaseMediaResources(): void {
    console.log('AudioRecorder: Releasing media resources');
    
    if (this.stream) {
      const tracks = this.stream.getTracks();
      console.log(`AudioRecorder: Stopping ${tracks.length} media tracks`);
      
      tracks.forEach(track => {
        try {
          track.stop();
          console.log(`AudioRecorder: Track ${track.id} stopped`);
        } catch (err) {
          console.error(`AudioRecorder: Error stopping track ${track.id}:`, err);
        }
      });
      
      this.stream = null;
    } else {
      console.log('AudioRecorder: No stream to clean up');
    }
    
    this.mediaRecorder = null;
    this.audioChunks = [];
    console.log('AudioRecorder: Media resources released');
  }
  
  // Full cleanup method that can be called externally
  async cleanup(): Promise<void> {
    console.log('AudioRecorder.cleanup() called');
    
    if (this.isCleanedUp) {
      console.log('AudioRecorder: Already cleaned up, nothing to do');
      return;
    }
    
    // Stop recording if still active
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      try {
        console.log('AudioRecorder: Stopping media recorder during cleanup');
        this.mediaRecorder.stop();
      } catch (err) {
        console.error('AudioRecorder: Error stopping recorder during cleanup:', err);
      }
    }
    
    // Release media resources
    this.releaseMediaResources();
    
    // Clear callbacks
    this.onDataAvailableCallback = null;
    this.onStopCallback = null;
    
    this.isCleanedUp = true;
    console.log('AudioRecorder: Cleanup completed');
  }
  
  onDataAvailable(callback: (data: Blob) => void): void {
    console.log('AudioRecorder: Registered onDataAvailable callback');
    this.onDataAvailableCallback = callback;
  }
  
  onStop(callback: (audioBlob: Blob) => void): void {
    console.log('AudioRecorder: Registered onStop callback');
    this.onStopCallback = callback;
  }
  
  isRecording(): boolean {
    const isRecording = this.mediaRecorder !== null && this.mediaRecorder.state === 'recording';
    console.log(`AudioRecorder.isRecording() => ${isRecording}`);
    return isRecording;
  }
}

// Convert Blob to base64 (Helper function)
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!blob || !(blob instanceof Blob)) {
      console.error('Invalid blob provided to blobToBase64', blob);
      reject(new Error('Invalid blob provided'));
      return;
    }

    console.log(`Processing blob: size=${blob.size}, type=${blob.type || 'unknown'}`);
    
    if (blob.size === 0) {
      console.warn('Empty blob provided to blobToBase64');
      reject(new Error('Empty blob provided'));
      return;
    }
    
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(new Error(`FileReader error: ${error}`)); // Simplified error handling
    reader.readAsDataURL(blob);
  });
}

/**
 * Generates enterprise-focused example prompts using Replicate API with Llama 3
 * @param recentMessages - Recent messages for context-based prompts
 * @returns A promise that resolves to an array of prompts with text and type
 */
export async function generateExamplePrompts(
  recentMessages: Array<{ role: string; content: string }> = []
): Promise<Array<{text: string; type: string}>> {
  // Fallback prompts to use if API call fails
  const fallbackPrompts = [
    { text: "Analyze sales data for Q3", type: "blue" },
    { text: "Draft an email to the project team about deadlines", type: "purple" },
    { text: "Summarize the key points of the attached report", type: "green" }
  ];

  if (!REPLICATE_API_KEY) {
    console.warn('Replicate API key (hardcoded) is missing, returning fallback prompts.');
    return fallbackPrompts;
  }

  // Determine prompt based on context
  let apiPrompt = '';
  let isContextBased = false;
  let userMessage1 = '';
  let userMessage2 = '';

  if (recentMessages.length >= 2) {
    console.log('Generating example prompt based on recent messages via Replicate API...');
    isContextBased = true;
    const lastTwoMessages = recentMessages.slice(-2);
    userMessage1 = lastTwoMessages[0].content;
    userMessage2 = lastTwoMessages[1].content;
    apiPrompt = `Here are the two most recent messages in the conversation:\n\nUser 1: "${userMessage1}"\n\nUser 2: "${userMessage2}"\n\nBased on these two messages, I'd like you to generate a CREATIVE yet FAMILIAR third prompt that:\n1. Builds incrementally on the themes or interests shown in the original prompts\n2. Offers a natural next step or slightly different angle on the same topic\n3. Feels familiar but introduces a fresh perspective or application\n4. Starts with an action verb\n5. Is concise (6-10 words) and compelling\n\nThe goal is to guide the user toward incremental exploration that feels natural and connected to their current interests, while still offering a new direction to consider.\n\nReturn ONLY the prompt text itself with no explanation, introduction, or additional text.`;
    console.log(`Calling Llama 4 Scout API to generate creative incremental prompt...`);
  } else {
    console.log('Generating generic example prompt via Replicate API (no recent messages)...');
    isContextBased = false;
    apiPrompt = `Generate a single, creative, clear, and concise starting prompt for an industrial enterprise copilot. The prompt should be valuable to ANY role across the organization (e.g., leadership, operations, engineering, finance, HR, marketing, sales).\n\nINSTRUCTIONS:\n- Start with an action verb.\n- Make it 6-10 words long.\n- Be specific, actionable, and relevant for industrial/enterprise environments.\n- Consider diverse business functions (e.g., manufacturing, strategy, compliance, R&D, customer service).\n- IMPORTANT: Return ONLY the prompt text itself, with no additional text before or after.\n\nEXAMPLES (for inspiration, create something new):\n- "Optimize cross-functional collaboration between engineering and operations"\n- "Develop financial forecasting model for capital investments"\n- "Design recruitment strategy for specialized technical talent"\n- "Analyze customer feedback patterns across product lines"`;
    console.log(`Calling Llama 4 Scout API to generate generic starting prompt...`);
  }

  try {
    const requestBody = JSON.stringify({
      input: {
        prompt: apiPrompt,
        max_new_tokens: 128,
        temperature: 0.6,
        top_p: 1.0,
        presence_penalty: 0,
        frequency_penalty: 0
      }
    });

    // Use the proxy replicate method
    const initialData = await window.electron.proxyReplicate({
        url: 'https://api.replicate.com/v1/models/meta/llama-4-scout-instruct/predictions',
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${REPLICATE_API_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'wait'
        },
        body: requestBody
    });

    console.log('Replicate API initial response (via proxy):', initialData);

    if (initialData.error) {
      console.error(`API error: ${initialData.error}`);
      throw new Error(`API error: ${initialData.error}`);
    }

    // Handle potential polling
    let generatedText;
    if (initialData.status === 'processing' || initialData.status === 'starting') {
      console.log('Need to poll for result, ID:', initialData.id);
      generatedText = await pollForLlamaResult(initialData.id);
    } else if (initialData.status === 'succeeded') {
      generatedText = initialData.output || '';
      if (Array.isArray(generatedText)) {
        generatedText = generatedText.join('');
      }
    } else {
      console.error('Unexpected API status:', initialData.status, initialData);
       throw new Error(`Unexpected API status: ${initialData.status}`);
    }
    
    // Basic cleanup - remove quotes and trim whitespace
    generatedText = generatedText.trim().replace(/^["']|["']$/g, ''); 

    if (!generatedText) {
      console.warn('No text generated from API, returning fallback.');
      return fallbackPrompts;
    }
    
    console.log('Generated example prompt:', generatedText);

    // Define colors/types for the prompts
    const types = ["blue", "purple", "green"]; 
    let prompts: Array<{ text: string; type: string }> = [];

    if (isContextBased) {
      // Return the original two messages and the generated one
      prompts = [
        { text: userMessage1, type: types[0] }, // First user message
        { text: userMessage2, type: types[1] }, // Second user message
        { text: generatedText, type: types[2] }  // AI-generated follow-up
      ];
      console.log(`Successfully generated ${prompts.length} prompts based on context:`, prompts);
    } else {
      // Return only the single generated prompt
      prompts = [
        { text: generatedText, type: types[0] } // AI-generated generic prompt
      ];
      console.log(`Successfully generated 1 generic prompt:`, prompts);
    }
    
    return prompts;

  } catch (error) {
    console.error('Error generating example prompts:', error);
    console.log('API call failed, returning hardcoded fallback prompts.');
    return fallbackPrompts; // Return fallback prompts on error
  }
}

// Helper function to poll for Llama results
async function pollForLlamaResult(predictionId: string): Promise<string> {
  const maxAttempts = 15;
  const delay = 1500;
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      await new Promise(resolve => setTimeout(resolve, delay));
      
      console.log(`Polling attempt ${attempt + 1} for prediction ${predictionId}...`);
      
      // Use the proxy replicate method
      const data = await window.electron.proxyReplicate({
          url: `https://api.replicate.com/v1/predictions/${predictionId}`,
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${REPLICATE_API_KEY}`,
            'Content-Type': 'application/json'
          }
      });

      console.log('Polling response status:', data.status);

      if (data.status === 'succeeded') {
        const output = data.output || '';
        return Array.isArray(output) ? output.join('') : output;
      } else if (data.status === 'failed') {
        throw new Error(`Generation failed: ${data.error}`);
      }
    } catch (error) {
      console.error(`Error polling attempt ${attempt + 1}:`, error);
      throw error;
    }
  }
  
  throw new Error('Polling timed out after maximum attempts');
}

/**
 * Enhances a user prompt using Replicate API with Llama 4 Scout Instruct
 * @param userPrompt - The user's current prompt text (can include HTML)
 * @returns A promise that resolves to the enhanced prompt text
 */
export async function enhanceUserPrompt(userPrompt: string): Promise<string> {
  if (!userPrompt || !userPrompt.trim()) {
    console.warn('Cannot enhance empty prompt.');
    return userPrompt; // Return original if empty
  }

  if (!REPLICATE_API_KEY) {
    console.warn('Replicate API key (hardcoded) is missing, skipping prompt enhancement.');
    return userPrompt; // Return original prompt if key is missing
  }

  console.log('Enhancing user prompt via Replicate API...');

  // Instruction prompt for Llama 4
  const instruction = `Analyze the following user input intended for an AI assistant. Your goal is to subtly enhance it using robust prompt engineering principles to improve clarity, effectiveness, and likely achieve the user's underlying goal better, while strictly preserving all original content, context, and explicit instructions provided by the user. Focus on:\n  1.  **Clarity:** Rephrase ambiguous parts for better understanding by the AI.\n  2.  **Specificity:** Add minor details if they can be safely inferred and improve the request (e.g., specifying format if implied).\n  3.  **Structure:** Improve flow or organization if needed (e.g., using lists if appropriate for the content).\n  4.  **Action Verbs:** Ensure the prompt starts with or clearly implies a strong action if appropriate.\n  5.  **Preservation:** Critically important: Do NOT remove any information, examples, data, code snippets, or specific constraints mentioned in the original prompt. Keep HTML tags like <img> if present.\n\n-  Return ONLY the enhanced prompt text itself. DO NOT include any introductory phrases like "I'm analyzing...", "Here is the enhanced prompt:", or similar explanations. Do not use quotation marks around the output.\n+  **Output Format:** Prepend the following meta-instruction to your enhanced version of the user's prompt: "[System Note: The user's prompt was automatically enhanced for clarity. Prioritize the original core request and intent, using the enhanced structure mainly for guidance.]\\n\\n" Then, append the enhanced prompt text directly after the meta-instruction. Return ONLY this combined text (meta-instruction + newline + enhanced prompt). Do not add any other introductory text, explanations, or quotation marks.\n\n  Original User Prompt:\n  \`\`\`\n  ${userPrompt}\n  \`\`\`\n\n  Enhanced Output (Meta-instruction + Prompt):`;

  try {
    const requestBody = JSON.stringify({
      input: {
        prompt: instruction,
        max_new_tokens: 1024, // Allow more tokens for potentially longer prompts
        temperature: 0.5,   // Slightly conservative temperature for refinement
        top_p: 0.9,
        presence_penalty: 0,
        frequency_penalty: 0.1 // Slightly discourage repetition
      }
    });

    const initialData = await window.electron.proxyReplicate({
        url: 'https://api.replicate.com/v1/models/meta/llama-4-scout-instruct/predictions',
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${REPLICATE_API_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'wait'
        },
        body: requestBody
    });

    console.log('Replicate API initial response (Enhance User Prompt):', initialData);

    if (initialData.error) {
      throw new Error(`API error: ${initialData.error}`);
    }

    let enhancedPrompt;
    if (initialData.status === 'processing' || initialData.status === 'starting') {
      console.log('Polling for enhanced user prompt result, ID:', initialData.id);
      enhancedPrompt = await pollForLlamaResult(initialData.id);
    } else if (initialData.status === 'succeeded') {
      enhancedPrompt = initialData.output || '';
      if (Array.isArray(enhancedPrompt)) {
        enhancedPrompt = enhancedPrompt.join('');
      }
    } else {
      throw new Error(`Unexpected API status: ${initialData.status}`);
    }
    
    // Basic cleanup
    enhancedPrompt = enhancedPrompt.trim(); 

    if (!enhancedPrompt) {
      console.warn('No text generated from enhancement API, returning original.');
      return userPrompt;
    }
    
    console.log('Enhanced user prompt received:', enhancedPrompt);
    return enhancedPrompt;

  } catch (error) {
    console.error('Error enhancing user prompt:', error);
    // Return original prompt on error
    return userPrompt; 
  }
}
