import {
  IChatMessage,
  IChatResponseMessage,
  IPromptDef,
} from 'intellichat/types';
import { isArray, isNull } from 'lodash';
import useSettingsStore from '../stores/useSettingsStore';

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
        'Authorization': '',
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
          'Authorization': '',
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
        'Authorization': '',
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
    
    return text;
  } catch (error: any) {
    // Re-throw AbortError to be caught by the caller
    if (error.name === 'AbortError') {
      throw error;
    }
    
    console.error('Error in speech-to-text:', error);
    throw new Error(error.message || 'Failed to transcribe audio');
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
          'Authorization': '',
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
        
        return text;
      } else if (data.status === 'failed') {
        throw new Error(`STT generation failed: ${data.error || 'Unknown error'}`);
      }
      // Continue polling if still processing
    } catch (error: any) {
      // If this is an abort error, propagate it
      if (error.name === 'AbortError') {
        throw error;
      }
      
      console.error('Error polling for STT result:', error);
      throw error;
    }
  }
  
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
