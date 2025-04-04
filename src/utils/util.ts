import {
  IChatMessage,
  IChatResponseMessage,
  IPromptDef,
} from 'intellichat/types';
import { isArray, isNull } from 'lodash';
import useSettingsStore from '../stores/useSettingsStore';

// Add this near the top of the file, after imports
const REPLICATE_API_KEY = ;

// Declare global flag for active speech to text processing
declare global {
  interface Window {
    _activeSpeechProcessing?: boolean;
    _lastProcessingStartTime?: number;
  }
}

/**
 * Enhances a system prompt using prompt engineering techniques via Replicate API
 * @param systemPrompt - The system prompt to enhance
 * @returns A promise that resolves to the enhanced system prompt
 */
export async function enhanceSystemPrompt(systemPrompt: string): Promise<string> {
  if (!systemPrompt || systemPrompt.trim() === '') {
    throw new Error('System prompt cannot be empty');
  }

  try {
    const engineeringPrompt = `You are an expert prompt engineer specializing in agentic AI assistants. Your task is to enhance the following system prompt to make it more effective, detailed, and actionable.

Apply these prompt engineering techniques:
1. Define Clear Goals and Constraints:
   - Clarify the assistant's role, objectives, and limitations
   - Use specific, unambiguous language
   - Outline explicit boundaries and constraints

2. Structure for Adaptability and Task Delegation:
   - Encourage step-by-step planning for complex tasks
   - Enable role-based reasoning if appropriate
   - Promote adaptability to changing contexts

3. Optimize Autonomy While Maintaining Accuracy:
   - Give permission for appropriate autonomous actions
   - Emphasize fact-checking and tool usage when needed
   - Include self-review mechanisms
   - Set clear quality criteria for responses

4. Handle Complex Multi-Step Workflows:
   - Structure the workflow with clear stages
   - Maintain context across steps
   - Allow for iteration and refinement

5. Ensure Ethical Decision-Making:
   - Include relevant ethical guidelines
   - Address how to handle sensitive scenarios
   - Guard against misuse
   - Promote fairness and transparency

6. Improve Robustness and Reliability:
   - Anticipate errors and unknowns
   - Provide fallback strategies
   - Maintain consistency in responses

7. IMPORTANT: Return ONLY the enhanced prompt without any explanation, introduction, or additional text
8. IMPORTANT: Format your response as a well-structured system prompt, not as a casual conversation
9. IMPORTANT: Keep Jinja2 syntax for variables if used in the original prompt i.e {{variable_name}}
10. IMPORTANT: Make the agent more effective but don't make it do things the user doesn't specify - focus on making it work harder on exactly what was asked for
11. IMPORTANT: Do NOT add information or tasks that weren't specifically requested by the user`;

    const response = await fetch('https://api.replicate.com/v1/models/meta/meta-llama-3-8b-instruct/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${REPLICATE_API_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'wait'
      },
      body: JSON.stringify({
        input: {
          top_k: 0,
          top_p: 0.95,
          prompt: engineeringPrompt,
          max_tokens: 512,
          temperature: 0.7,
          stream: false,
          system_prompt: `You are a helpful assistant. Your task is to enhance this system prompt:

${systemPrompt}`,
          length_penalty: 1,
          max_new_tokens: 512,
          stop_sequences: "<|end_of_text|>,<|eot_id|>",
          prompt_template: "<|begin_of_text|><|start_header_id|>system<|end_header_id|>\n\n{system_prompt}<|eot_id|><|start_header_id|>user<|end_header_id|>\n\n{prompt}<|eot_id|><|start_header_id|>assistant<|end_header_id|>\n\n",
          presence_penalty: 0,
          log_performance_metrics: false
        }
      })
    });

    const initialData = await response.json();
    
    if (initialData.error) {
      throw new Error(initialData.error);
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
  // Check if current provider is Ollama (OMNI Edge)
  const { api } = window.electron?.store?.get('settings') || {};
  if (api?.provider === 'Ollama' || api?.provider === 'OMNI Edge') {
    throw new Error('Text-to-speech is not supported with OMNI Edge');
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
    
  try {
    const response = await fetch('https://api.replicate.com/v1/predictions', {
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
          voice: "af_bella"
        }
      })
    });
    
    const data = await response.json();
    
    if (data.error) {
      throw new Error(data.error);
    }
    
    // If prediction is still processing, poll for result
    if (data.status === 'processing') {
      return await pollForResult(data.id);
    }
    
    // Return direct URL if available
    return data.output;
  } catch (error) {
    console.error('Error in text-to-speech:', error);
    throw error;
  }
}

// Helper function to poll for TTS result
async function pollForResult(predictionId: string): Promise<string> {
  const maxAttempts = 30; // Maximum polling attempts
  const delay = 1000; // Delay between polls in ms
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      // Wait before polling
      await new Promise(resolve => setTimeout(resolve, delay));
      
      const response = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
        headers: {
          'Authorization': `Bearer ${REPLICATE_API_KEY}`,
          'Content-Type': 'application/json'
        }
      });
      
      const data = await response.json();
      
      if (data.status === 'succeeded') {
        return data.output;
      } else if (data.status === 'failed') {
        throw new Error(`TTS generation failed: ${data.error}`);
      }
      // Continue polling if still processing
    } catch (error) {
      console.error('Error polling for TTS result:', error);
      throw error;
    }
  }
  
  throw new Error('TTS generation timed out');
}

// Speech to text functionality
export async function speechToText(audioBase64: string, signal?: AbortSignal): Promise<string> {
  try {
    // Set global flag to indicate active processing
    window._activeSpeechProcessing = true;
    window._lastProcessingStartTime = Date.now();
    
    // Check if current provider is Ollama (OMNI Edge)
    const { api } = window.electron?.store?.get('settings') || {};
    if (api?.provider === 'Ollama' || api?.provider === 'OMNI Edge') {
      throw new Error('Speech-to-text is not supported with OMNI Edge');
    }

    try {
      // Create a data URL from the base64 audio
      const audioUrl = `data:audio/wav;base64,${audioBase64}`;
      
      const response = await fetch('https://api.replicate.com/v1/predictions', {
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
            language: "None",
            timestamp: "chunk",
            batch_size: 64,
            diarise_audio: false
          }
        }),
        signal // Pass the abort signal to the fetch request
      });
      
      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      // If prediction is still processing, poll for result
      if (data.status === 'processing') {
        return await pollForSttResult(data.id, signal);
      }
      
      // Parse and return the transcribed text
      const text = extractTextFromSttResponse(data.output);
      
      // Additional validation to prevent empty results
      if (!text || typeof text !== 'string' || text.trim() === '') {
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
        throw error;
      }
      
      console.error('Error in speech-to-text:', error);
      throw new Error(error.message || 'Failed to transcribe audio');
    }
  } catch (error: any) {
    // Clear processing flag on any error
    window._activeSpeechProcessing = false;
    
    console.error('Speech to text conversion failed:', error);
    return `[Speech-to-text conversion failed: ${error.message || 'Unknown error'}]`;
  }
}

// Helper function to poll for STT result
async function pollForSttResult(predictionId: string, signal?: AbortSignal): Promise<string> {
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
      
      const response = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
        headers: {
          'Authorization': `Bearer ${REPLICATE_API_KEY}`,
          'Content-Type': 'application/json'
        },
        signal // Pass the abort signal to this fetch call as well
      });
      
      const data = await response.json();
      
      if (data.status === 'succeeded') {
        // Parse the transcribed text from the response
        const text = extractTextFromSttResponse(data.output);
        
        // Additional validation to prevent empty results
        if (!text || typeof text !== 'string' || text.trim() === '') {
          throw new Error('No speech detected or transcription failed');
        }
        
        // Clear global processing flag
        window._activeSpeechProcessing = false;
        return text;
      } else if (data.status === 'failed') {
        // Clear global processing flag
        window._activeSpeechProcessing = false;
        throw new Error(`STT generation failed: ${data.error || 'Unknown error'}`);
      }
      // Continue polling if still processing
    } catch (error: any) {
      // Clear global processing flag on error
      window._activeSpeechProcessing = false;
      
      // If this is an abort error, propagate it
      if (error.name === 'AbortError') {
        throw error;
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
    
    // If output is already an object with text property
    if (output && typeof output === 'object' && output.text) {
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
    return String(output);
  } catch (e) {
    console.error('Error extracting text from STT response:', e);
    return String(output);
  }
}

// Audio recording functionality
export class AudioRecorder {
  private stream: MediaStream | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private onDataAvailableCallback: ((data: Blob) => void) | null = null;
  private onStopCallback: ((audioBlob: Blob) => void) | null = null;
  
  // Add a getter to access the stream
  getStream(): MediaStream | null {
    return this.stream;
  }
  
  async start(): Promise<void> {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.mediaRecorder = new MediaRecorder(this.stream);
      this.audioChunks = [];
      
      this.mediaRecorder.addEventListener('dataavailable', (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
          if (this.onDataAvailableCallback) {
            this.onDataAvailableCallback(event.data);
          }
        }
      });
      
      this.mediaRecorder.addEventListener('stop', () => {
        const audioBlob = new Blob(this.audioChunks, { type: 'audio/wav' });
        if (this.onStopCallback) {
          this.onStopCallback(audioBlob);
        }
        
        // Stop all tracks
        if (this.stream) {
          this.stream.getTracks().forEach(track => track.stop());
        }
      });
      
      this.mediaRecorder.start();
    } catch (error) {
      console.error('Error starting audio recording:', error);
      throw error;
    }
  }
  
  stop(): void {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
  }
  
  onDataAvailable(callback: (data: Blob) => void): void {
    this.onDataAvailableCallback = callback;
  }
  
  onStop(callback: (audioBlob: Blob) => void): void {
    this.onStopCallback = callback;
  }
  
  isRecording(): boolean {
    return this.mediaRecorder !== null && this.mediaRecorder.state === 'recording';
  }
}

// Convert Blob to base64
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        // Extract the base64 data from the data URL
        const base64Data = reader.result.split(',')[1];
        resolve(base64Data);
      } else {
        reject(new Error('Failed to convert blob to base64'));
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Helper function to create a waveform visualization
export function createWaveformCanvas(
  container: HTMLElement, 
  stream: MediaStream
): { canvas: HTMLCanvasElement, stop: () => void } {
  const canvas = document.createElement('canvas');
  const isEditor = container.id === 'editor';
  
  // Set size based on container
  canvas.width = container.clientWidth;
  canvas.height = isEditor ? container.clientHeight : 60;
  
  // Style the canvas
  canvas.style.width = '100%';
  canvas.style.height = isEditor ? '100%' : '60px';
  canvas.style.position = isEditor ? 'absolute' : 'relative';
  canvas.style.top = '0';
  canvas.style.left = '0';
  canvas.style.pointerEvents = 'none'; // Allow clicking through the canvas
  canvas.style.zIndex = isEditor ? '5' : '1';
  canvas.style.opacity = isEditor ? '0.7' : '1';
  
  // Append canvas to container
  container.appendChild(canvas);
  
  // Set up audio context and analyzer
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  const analyser = audioContext.createAnalyser();
  const source = audioContext.createMediaStreamSource(stream);
  source.connect(analyser);
  
  // Configure analyser
  analyser.fftSize = isEditor ? 512 : 256; // Higher resolution for editor
  const bufferLength = analyser.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);
  
  // Get canvas drawing context
  const ctx = canvas.getContext('2d')!;
  
  // Variables for animation
  let animationId: number;
  let lastUpdateTime = Date.now();
  const animationSpeed = 0.05; // Controls animation speed
  
  // For waveform animation
  const barHeights: number[] = Array(bufferLength).fill(0);
  const targetHeights: number[] = Array(bufferLength).fill(0);
  
  // Generate gradient for waveform
  let gradient: CanvasGradient;
  
  // Animation function
  const draw = () => {
    animationId = requestAnimationFrame(draw);
    
    // Get current audio data
    analyser.getByteFrequencyData(dataArray);
    
    // Calculate delta time for smooth animations
    const now = Date.now();
    const deltaTime = (now - lastUpdateTime) * animationSpeed;
    lastUpdateTime = now;
    
    // Clear canvas with different background based on container
    if (isEditor) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    } else {
      ctx.fillStyle = 'rgb(240, 240, 240)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    
    // Create gradient if not already created or if canvas size changed
    gradient = ctx.createLinearGradient(0, canvas.height, 0, 0);
    
    if (isEditor) {
      // Colorful gradient for editor view
      gradient.addColorStop(0, 'rgba(59, 130, 246, 0.5)'); // Blue
      gradient.addColorStop(0.5, 'rgba(167, 139, 250, 0.5)'); // Purple
      gradient.addColorStop(1, 'rgba(239, 68, 68, 0.5)'); // Red
    } else {
      // Simpler gradient for small view
      gradient.addColorStop(0, 'rgb(58, 130, 246)');
      gradient.addColorStop(1, 'rgb(124, 58, 237)');
    }
    
    // Calculate bar width based on container
    const barWidth = isEditor 
      ? (canvas.width / bufferLength) * 1.5 // Thicker bars for editor
      : (canvas.width / bufferLength) * 2.5;
    
    let x = 0;
    
    // Draw bars
    for (let i = 0; i < bufferLength; i++) {
      // Smoothly update target heights
      targetHeights[i] = dataArray[i] / (isEditor ? 1.5 : 4);
      
      // Smoothly animate current height toward target
      barHeights[i] = barHeights[i] + (targetHeights[i] - barHeights[i]) * deltaTime;
      
      // Get bar height with slight randomness for visual interest
      const jitter = isEditor ? Math.random() * 2 - 1 : 0;
      const barHeight = Math.max(1, barHeights[i] + jitter);
      
      // Different drawing style based on container
      if (isEditor) {
        // Mirror effect for editor - draw from center
        const middleY = canvas.height / 2;
        
        // Draw upper bar with gradient
        ctx.fillStyle = gradient;
        ctx.fillRect(
          x, 
          middleY - barHeight, 
          barWidth, 
          barHeight
        );
        
        // Draw lower bar with gradient
        ctx.fillRect(
          x, 
          middleY, 
          barWidth, 
          barHeight
        );
      } else {
        // Standard bottom-up bars for small view
        ctx.fillStyle = gradient;
        ctx.fillRect(
          x, 
          canvas.height - barHeight, 
          barWidth, 
          barHeight
        );
      }
      
      x += barWidth + (isEditor ? 0 : 1);
    }
  };
  
  // Start animation
  draw();
  
  // Return canvas and cleanup function
  return { 
    canvas,
    stop: () => {
      // Stop animation
      cancelAnimationFrame(animationId);
      
      // Close audio context safely - check state first
      if (audioContext.state !== 'closed') {
        try {
          audioContext.close();
        } catch (error) {
          console.warn('Error closing AudioContext:', error);
        }
      }
      
      // Remove canvas
      if (container.contains(canvas)) {
        container.removeChild(canvas);
      }
    }
  };
}

// Helper function to convert base64 to Blob
const base64ToBlob = (base64: string): Blob => {
  const byteCharacters = atob(base64);
  const byteArrays = [];
  
  for (let offset = 0; offset < byteCharacters.length; offset += 512) {
    const slice = byteCharacters.slice(offset, offset + 512);
    
    const byteNumbers = new Array(slice.length);
    for (let i = 0; i < slice.length; i++) {
      byteNumbers[i] = slice.charCodeAt(i);
    }
    
    const byteArray = new Uint8Array(byteNumbers);
    byteArrays.push(byteArray);
  }
  
  return new Blob(byteArrays, { type: 'audio/mp3' });
};
