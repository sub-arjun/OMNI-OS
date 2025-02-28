import { IServiceProvider } from './types';

export default {
  name: 'OMNI',
  apiBase: 'https://openrouter.ai/api/v1', // Updated to correct OpenRouter API endpoint
  apiKey: 'sk-or-...',  // Add a placeholder API key that will be overridden
  currency: 'USD',
  isPremium: false,
  description: 'Premium provider powered by top American AI models',
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
      'anthropic/claude-3.7-sonnet': {
        name: 'anthropic/claude-3.7-sonnet',
        label: 'Claude 3.7 Sonnet',
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
        description: `Anthropic's latest and most advanced model with exceptional reasoning capabilities`,
        group: 'Claude-3.7',
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
        description: `Enhanced Claude 3.7 Sonnet with reasoning trace capability for step-by-step thinking`,
        group: 'Claude-3.7',
      },
      'openai/o3-mini-high': {
        name: 'openai/o3-mini-high',
        label: 'O3 Mini High',
        contextWindow: 200000,
        maxTokens: 100000,
        defaultMaxTokens: 4000,
        inputPrice: 0.0011,
        outputPrice: 0.004,
        vision: {
          enabled: true,
          allowBase64: true,
          allowUrl: true,
        },
        toolEnabled: true,
        description: `OpenAI's compact reasoning model with tool capabilities and excellent performance/cost ratio`,
        group: 'O',
      },
      'openai/gpt-4.5 Orion': {
        name: 'openai/gpt-4.5-preview',
        label: 'GPT-4.5',
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
        description: `OpenAI's most advanced multimodal model with fast processing and strong vision capabilities`,
        group: 'GPT-4',
      },

    },
  },
} as IServiceProvider; 