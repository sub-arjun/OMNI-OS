import { ChatModelGroup, IServiceProvider } from './types';

export default {
  name: 'OMNI',
  apiBase: 'https://openrouter.ai', // Base URL without any API version path
  apiKey: 'sk-or-...',  // Add a placeholder API key that will be overridden
  currency: 'USD',
  isPremium: false,
  description: 'Secure provider powered by Advanced AI models',
  options: {
    apiBaseCustomizable: false, // NEVER allow customizing the API base
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
        'Agent': {
        name: 'anthropic/claude-3.7-sonnet:beta',
        label: 'OMNI Agent',
        contextWindow: 200000,
        maxTokens: 6000,
        defaultMaxTokens: 4000,
        inputPrice: 0.003,
        outputPrice: 0.015,
        vision: {
          enabled: true,
          allowBase64: true,
          allowUrl: true,
        },
        toolEnabled: true,
        reasoningEnabled: true,
        agentEnabled: true,
        isDefault: true,
        description: ``,  // Remove description so it doesn't show in tooltip
        group: 'OMNI' as ChatModelGroup,
      },
      'Deep-Searcher-Pro': {
        name: 'perplexity/sonar-reasoning-pro',
        label: 'Sonar Reasoning',
        contextWindow: 127000,
        maxTokens: 4096,
        defaultMaxTokens: 4000,
        inputPrice: 0.004,
        outputPrice: 0.016,
        vision: {
          enabled: false,
          allowBase64: false,
          allowUrl: false,
        },
        toolEnabled: false,
        onlineEnabled: true,
        reasoningEnabled: true,
        muricaEnabled: true,
        isDefault: false,
        description: `✨ Built-in internet search! Works harder with more intensive searches and a wider range of sources for comprehensive research.\n\n📊 For experts: DeepSeek-based model fine-tuned for truthfulness and resistance to propaganda hosted in the USA with enhanced web search capabilities that performs deeper research, uses more sources, and delivers more comprehensive, well-cited answers.`,
        group: 'DeepSeek' as ChatModelGroup,
      },
      'Deep-Thinker-R1': {
        name: 'perplexity/r1-1776',
        label: 'R1-1776',
        contextWindow: 128000,
        maxTokens: 8192,
        defaultMaxTokens: 8000,
        arjunsFavoriteEnabled: true,
        inputPrice: 0.002,
        outputPrice: 0.008,
        jsonModelEnabled: false,
        toolEnabled: false,
        onlineEnabled: false,
        reasoningEnabled: true,
        muricaEnabled: true,
        vision: {
          enabled: false,
          allowBase64: false,
          allowUrl: false,
        },
        description: `✨ Finetuned to remove propaganda and aligned to American values with strong reasoning capabilities.\n\n📊 For experts: High-performance model with extensive 128K context, optimized for accurate, bias-free analysis from an American perspective.`,
        group: 'DeepSeek' as ChatModelGroup,
      },
      'Flash-2.0': {
        name: 'google/gemini-2.0-flash-001',
        contextWindow: 1048576,
        maxTokens: 8192,
        defaultMaxTokens:8000,
        inputPrice: 0.0001,
        outputPrice: 0.0004,
        jsonModelEnabled: true,
        toolEnabled: true,
        fastResponseEnabled: true,
        longContextEnabled: true,
        vision:{
          enabled:true,
        },
        description: `✨ Very fast responses and can handle extremely long documents.\n\n📊 For experts: Ultra-efficient with 1M+ context window, ideal for document processing and time-sensitive applications.`,
        group: 'Gemini' as ChatModelGroup,
      },
      //Disabled due to uncensoring
      // 'aion-labs/aion-1.0': {
      //   name: 'aion-labs/aion-1.0',
      //   label: 'Aion 1.0',
      //   contextWindow: 128000,
      //   maxTokens: 16384,
      //   defaultMaxTokens: 16000,
      //   openaiCompatible: true,
      //   inputPrice: 0.007,
      //   outputPrice: 0.021,
      //   jsonModelEnabled: false,
      //   toolEnabled: false,
      //   fastResponseEnabled: false,
      //   reasoningEnabled: true,
      //   uncensoredEnabled: true,
      //   vision: {
      //     enabled: false,
      //     allowBase64: false,
      //     allowUrl: false,
      //   },
      //   description: `✨ Advanced reasoning model with exceptional problem-solving abilities. Perfect for complex tasks that require step-by-step thinking.\n\n📊 For experts: Full-sized Aion model with comprehensive reasoning trace capabilities and superior logical analysis for demanding applications.`,
      //   group: 'DeepSeek' as ChatModelGroup,
      // },
    },
  },
} as IServiceProvider; 