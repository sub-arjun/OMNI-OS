import { ChatModelGroup, IServiceProvider } from './types';

export default {
  name: 'OMNI',
  apiBase: 'https://openrouter.ai/api/v1', // Updated to correct OpenRouter API endpoint
  apiKey: 'sk-or-...',  // Add a placeholder API key that will be overridden
  currency: 'USD',
  isPremium: false,
  description: 'Secure provider powered by top American AI models',
  options: {
    apiBaseCustomizable: false,
    apiKeyCustomizable: true, // Allow users to enter their OpenRouter API key
  },
  chat: {
    apiSchema: ['base', 'key', 'model'], // Add 'key' to schema to enable API key input
    presencePenalty: { min: -2, max: 2, default: 0 },
    topP: { min: 0, max: 1, default: 1 },
    temperature: { min: 0, max: 2, default: 0.9 },
    options: {
      modelCustomizable: true,
      streamCustomizable: false,
    },
    models: {
        'AUTO 🪄 AI Selects Best Model 🪄 (Experimental)': {
        name: 'openrouter/auto',
        label: 'OmniRouter',
        contextWindow: 200000,
        maxTokens: 4096,
        defaultMaxTokens: 4000,
        inputPrice: 0.003,
        outputPrice: 0.015,
        vision: {
          enabled: true,
          allowBase64: true,
          allowUrl: true,
        },
        toolEnabled: true,
        isDefault: true,
        autoEnabled: true,
        description: `✨ Let AI pick the best model for your question.\n\n📊 For experts: Auto-router selects optimal model based on query content, balancing capabilities and cost efficiency.`,
        group: 'OMNI' as ChatModelGroup,
      },
      'Deep-Searcher-R1': {
        name: 'perplexity/sonar-reasoning',
        label: 'Sonar Reasoning',
        contextWindow: 127000,
        maxTokens: 4096,
        defaultMaxTokens: 4000,
        inputPrice: 0.004,
        outputPrice: 0.016,
        vision: {
          enabled: true,
          allowBase64: true,
          allowUrl: true,
        },
        toolEnabled: false,
        onlineEnabled: true,
        reasoningEnabled: true,
        muricaEnabled: true,
        isDefault: false,
        description: `✨ Built-in internet search! Great for facts, news, and research.\n\n📊 For experts: DeepSeek-based model fine-tuned for truthfulness and resistance to propoganda hosted in the USA with integrated web search capabilities for research, citations, and up-to-date answers.`,
        group: 'DeepSeek' as ChatModelGroup,
      },
      'Deep-Thinker-R1': {
        name: 'perplexity/r1-1776',
        label: 'R1-1776',
        contextWindow: 128000,
        maxTokens: 8192,
        defaultMaxTokens: 8000,
        inputPrice: 0.002,
        outputPrice: 0.008,
        jsonModelEnabled: false,
        toolEnabled: false,
        onlineEnabled: false,
        reasoningEnabled: true,
        muricaEnabled: true,
        vision: {
          enabled: true,
          allowBase64: true,
          allowUrl: true,
        },
        description: `✨ Finetuned to remove propaganda and aligned to American values with strong reasoning capabilities.\n\n📊 For experts: High-performance model with extensive 128K context, optimized for accurate, bias-free analysis from an American perspective.`,
        group: 'DeepSeek' as ChatModelGroup,
      },
      'anthropic/claude-3.7-sonnet:thinking': {
        name: 'anthropic/claude-3.7-sonnet:thinking',
        label: 'Claude 3.7 Sonnet (Thinking)',
        contextWindow: 200000,
        maxTokens: 4096,
        defaultMaxTokens: 4000,
        inputPrice: 0.0035,
        outputPrice: 0.017,
        vision: {
          enabled: true,
          allowBase64: true,
          allowUrl: true,
        },
        toolEnabled: true,
        reasoningEnabled: true,
        arjunsFavoriteEnabled: true,
        description: `✨ Shows its work step-by-step. Great for math & science problems, code and complex questions.\n\n📊 For experts: Claude 3.7 with exposed reasoning trace for transparency and verification of complex reasoning.`,
        group: 'Claude-3.7' as ChatModelGroup,
      },
      'openai/gpt-4o': {
        name: 'openai/gpt-4o',
        label: 'GPT-4o',
        contextWindow: 128000,
        maxTokens: 4096,
        defaultMaxTokens: 4000,
        inputPrice: 0.005,
        outputPrice: 0.015,
        vision: {
          enabled: true,
          allowBase64: true,
          allowUrl: true,
        },
        toolEnabled: true,
        description: `✨ Great all-around model. Handles images and complex questions well.\n\n📊 For experts: OpenAI's multimodal flagship with 128K context, strong reasoning and tool use capabilities.`,
        group: 'GPT-4' as ChatModelGroup,
      },
      'google/gemini-2.0-flash': {
        name: 'google/gemini-2.0-flash-001',
        contextWindow: 1048576,
        maxTokens: 8192,
        defaultMaxTokens:8000,
        inputPrice: 0.0001,
        outputPrice: 0.0004,
        jsonModelEnabled: true,
        toolEnabled: true,
        fastResponseEnabled: true,
        vision:{
          enabled:true,
        },
        description: `✨ Very fast responses and can handle extremely long documents.\n\n📊 For experts: Ultra-efficient with 1M+ context window, ideal for document processing and time-sensitive applications.`,
        group: 'Gemini' as ChatModelGroup,
      },

      'aion-labs/aion-1.0': {
        name: 'aion-labs/aion-1.0',
        label: 'Aion 1.0',
        contextWindow: 128000,
        maxTokens: 16384,
        defaultMaxTokens: 16000,
        inputPrice: 0.007,
        outputPrice: 0.021,
        jsonModelEnabled: false,
        toolEnabled: false,
        fastResponseEnabled: false,
        reasoningEnabled: true,
        uncensoredEnabled: true,
        vision: {
          enabled: true,
          allowBase64: true,
          allowUrl: true,
        },
        description: `✨ Advanced reasoning model with exceptional problem-solving abilities. Perfect for complex tasks that require step-by-step thinking.\n\n📊 For experts: Full-sized Aion model with comprehensive reasoning trace capabilities and superior logical analysis for demanding applications.`,
        group: 'Gemini' as ChatModelGroup,
      },
      
      'allenai/llama-3.1-tulu-3-405b': {
        name: 'allenai/llama-3.1-tulu-3-405b',
        label: 'Tulu-3 405B',
        contextWindow: 16000,
        maxTokens: 4096,
        defaultMaxTokens: 4000,
        inputPrice: 0.0015,
        outputPrice: 0.0025,
        vision: {
          enabled: true,
          allowBase64: true,
          allowUrl: true,
        },
        toolEnabled: true,
        isDefault: false,
        description: `✨ Powerful open-source model with excellent accuracy and image understanding.\n\n📊 For experts: 405B parameter Llama 3.1-based model with multimodal capabilities and fully transparent processing.`,
        group: 'Open Source' as ChatModelGroup,
      },
    },
  },
} as IServiceProvider; 