import { ChatModelGroup, IServiceProvider } from './types';

// Helper function to safely access electron store
const getDefaultModel = () => {
  try {
    if (typeof window !== 'undefined' && window.electron?.store) {
      return window.electron.store.get('settings.ollama.currentModel', 'llama3');
    }
    return 'llama3';
  } catch (error) {
    console.error('Error accessing electron store:', error);
    return 'llama3';
  }
};

export default {
  name: 'Ollama',
  displayName: 'OMNI Edge',
  description: 'Run AI models On Premise on your device for maximum privacy',
  apiBase: 'http://127.0.0.1:11434',
  currency: 'USD',
  options: {
    apiBaseCustomizable: true,
  },
  // Store the current model name for persistence
  currentModel: getDefaultModel(),
  chat: {
    apiSchema: ['base', 'model'],
    docs: {
      temperature:
        'Higher values will make the output more creative and unpredictable, while lower values will make it more precise.',
      presencePenalty:
        "Positive values penalize new tokens based on whether they appear in the text so far, increasing the model's likelihood to talk about new topics.",
      topP: 'An alternative to sampling with temperature, called nucleus sampling, where the model considers the results of the tokens with topP probability mass.',
    },
    placeholders: {
      base: 'http://127.0.0.1:11434',
      model: 'llama3', // Add a specific model placeholder
    },
    presencePenalty: { min: -2, max: 2, default: 0 },
    topP: { min: 0, max: 1, default: 1 },
    temperature: { min: 0, max: 1, default: 0.9 },

    options: {
      modelCustomizable: true,
    },
    // Empty models object - will be populated from the Ollama server
    models: {}
  },
  embedding: {
    apiSchema: ['base', 'model'],
    placeholders: {
      base: 'http://127.0.0.1:11434',
      model: 'nomic-embed-text', // Common embedding model for Ollama
    },
    options: {
      modelCustomizable: true,
    },
    models: {}
  },
} as IServiceProvider;
