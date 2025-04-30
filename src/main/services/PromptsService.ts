import { ipcMain } from 'electron';
import Debug from 'debug';
import path from 'path';
import fs from 'fs';
import { generateExamplePrompts } from '../../utils/util';

const debug = Debug('OMNI-OS:PromptsService');

/**
 * Service to generate and manage enterprise-focused example prompts
 * Uses Replicate API for prompt generation, generating one prompt at a time as needed
 */
export default class PromptsService {
  private promptsStorePath: string;
  private promptsData: {
    lastGenerated: number;
    prompts: Array<{
      text: string;
      type: 'blue' | 'purple' | 'green';
    }>;
  };
  private generationInterval: NodeJS.Timeout | null = null;
  private isGenerating: boolean = false;
  
  constructor(appDataPath: string) {
    this.promptsStorePath = path.join(appDataPath, 'prompts-store.json');
    this.promptsData = {
      lastGenerated: 0,
      prompts: []
    };
    
    // Initialize asynchronously
    this.initialize();
  }
  
  /**
   * Initialize the service asynchronously
   */
  private async initialize() {
    await this.loadPrompts();
    this.setupIPC();
    this.startPromptGeneration();
  }
  
  /**
   * Load prompts from file or initialize with empty array
   */
  private async loadPrompts() {
    try {
      if (fs.existsSync(this.promptsStorePath)) {
        const data = fs.readFileSync(this.promptsStorePath, 'utf8');
        this.promptsData = JSON.parse(data);
        debug('Loaded prompts from disk');
      } else {
        debug('No prompts file found, initializing with empty prompts');
        this.promptsData = {
          lastGenerated: 0,
          prompts: []
        };
        this.savePrompts();
      }
    } catch (error) {
      debug('Error loading prompts:', error);
      this.promptsData = {
        lastGenerated: 0,
        prompts: []
      };
      this.savePrompts();
    }
  }
  
  /**
   * Save prompts to file
   */
  private savePrompts() {
    try {
      fs.writeFileSync(
        this.promptsStorePath,
        JSON.stringify(this.promptsData, null, 2),
        'utf8'
      );
      debug('Saved prompts to disk');
    } catch (error) {
      debug('Error saving prompts:', error);
    }
  }
  
  /**
   * Generate a single prompt using the API
   * @returns A prompt with assigned color
   */
  private async generateSinglePrompt(): Promise<{text: string; type: 'blue' | 'purple' | 'green'} | null> {
    try {
      debug('Generating a single prompt using API...');
      
      // Use the API to generate a single prompt
      const generatedPrompts = await generateExamplePrompts(1);
      
      if (generatedPrompts && generatedPrompts.length > 0 && generatedPrompts[0].text) {
        const promptText = generatedPrompts[0].text;
        debug(`Successfully received prompt from API: ${promptText}`);
        
        // Determine the color to use - rotate through the colors
        const currentPrompts = this.promptsData.prompts;
        let type: 'blue' | 'purple' | 'green';
        
        // Count current colors to determine which one to use next
        const blueCount = currentPrompts.filter(p => p.type === 'blue').length;
        const purpleCount = currentPrompts.filter(p => p.type === 'purple').length;
        const greenCount = currentPrompts.filter(p => p.type === 'green').length;
        
        // Assign color based on which has the lowest count
        if (blueCount <= purpleCount && blueCount <= greenCount) {
          type = 'blue';
        } else if (purpleCount <= blueCount && purpleCount <= greenCount) {
          type = 'purple';
        } else {
          type = 'green';
        }
        
        return {
          text: promptText,
          type
        };
      } else {
        debug('API did not return a valid prompt');
        return null;
      }
    } catch (error) {
      debug('Error generating prompt from API:', error);
      console.error('PromptsService API error:', error);
      return null;
    }
  }
  
  /**
   * Setup IPC handlers for renderer process
   */
  private setupIPC() {
    // Handler to get current prompts
    ipcMain.handle('prompts:get', async () => {
      return this.getPrompts();
    });
    
    // Handler to force refresh prompts
    ipcMain.handle('prompts:refresh', async () => {
      await this.generateNewPrompt();
      return this.getPrompts();
    });
  }
  
  /**
   * Start the prompt generation interval
   */
  private startPromptGeneration() {
    // Check if prompts need to be generated now
    this.checkAndGeneratePrompts();
    
    // Set up interval to check regularly
    this.generationInterval = setInterval(() => {
      this.checkAndGeneratePrompts();
    }, 20 * 60 * 1000); // Check every 20 minutes
  }
  
  /**
   * Check if prompts need to be generated and generate if needed
   */
  private async checkAndGeneratePrompts() {
    // If we have less than the target number of prompts, generate more
    if (this.promptsData.prompts.length < 12) {
      debug(`Current prompt count (${this.promptsData.prompts.length}) less than target (12), generating more`);
      try {
        await this.generateNewPrompt();
      } catch (error) {
        debug('Error generating prompts:', error);
      }
    } else {
      // Check if prompts are too old
      const now = Date.now();
      const oneDay = 24 * 60 * 60 * 1000;
      
      if (now - this.promptsData.lastGenerated > oneDay) {
        debug('Prompts are a day old, refreshing one prompt');
        try {
          await this.refreshOnePrompt();
        } catch (error) {
          debug('Error refreshing prompt:', error);
        }
      } else {
        debug('Prompts are fresh, not generating new ones');
      }
    }
  }
  
  /**
   * Refresh a random prompt in the collection
   */
  private async refreshOnePrompt() {
    if (this.isGenerating) {
      debug('Already generating a prompt, skipping');
      return;
    }
    
    this.isGenerating = true;
    try {
      const newPrompt = await this.generateSinglePrompt();
      if (newPrompt) {
        // Remove a random prompt
        const randomIndex = Math.floor(Math.random() * this.promptsData.prompts.length);
        this.promptsData.prompts.splice(randomIndex, 1);
        
        // Add the new prompt
        this.promptsData.prompts.push(newPrompt);
        this.promptsData.lastGenerated = Date.now();
        this.savePrompts();
        debug('Successfully refreshed one prompt');
      }
    } catch (error) {
      debug('Error refreshing prompt:', error);
    } finally {
      this.isGenerating = false;
    }
  }
  
  /**
   * Generate a new prompt and add it to the collection
   */
  private async generateNewPrompt() {
    if (this.isGenerating) {
      debug('Already generating a prompt, skipping');
      return;
    }
    
    debug('Starting new prompt generation process');
    this.isGenerating = true;
    
    try {
      // Generate a new prompt
      const newPrompt = await this.generateSinglePrompt();
      
      if (newPrompt) {
        debug(`Successfully generated new prompt: ${newPrompt.text}`);
        // Update prompts data
        this.promptsData.prompts.push(newPrompt);
        this.promptsData.lastGenerated = Date.now();
        
        // Save to disk
        this.savePrompts();
        debug('Added and saved new prompt');
      } else {
        debug('Failed to generate a new prompt');
      }
    } catch (error) {
      debug('Error in generateNewPrompt:', error);
      console.error('PromptsService generateNewPrompt error:', error);
    } finally {
      this.isGenerating = false;
    }
  }
  
  /**
   * Get random prompts for display
   */
  public async getPrompts() {
    // Ensure we have prompts - generate if needed
    if (!this.promptsData.prompts || this.promptsData.prompts.length === 0) {
      debug('No prompts available, attempting to generate');
      // Try to generate prompts
      for (let i = 0; i < 3; i++) {
        await this.generateNewPrompt();
      }
    }
    
    try {
      // Get the available prompts
      const availablePrompts = [...this.promptsData.prompts];
      debug(`Have ${availablePrompts.length} prompts available`);
      
      // If we still have no prompts, return empty array
      if (availablePrompts.length === 0) {
        debug('No prompts available after generation attempts');
        return [];
      }
      
      // If we have less than 3 prompts, use what we have
      if (availablePrompts.length <= 3) {
        debug(`Returning all ${availablePrompts.length} available prompts`);
        return availablePrompts;
      }
      
      // Validate the prompts 
      const validPrompts = availablePrompts.filter(p => 
        typeof p.text === 'string' && p.text.trim() !== ''
      );
      
      if (validPrompts.length === 0) {
        debug('No valid prompts found');
        return [];
      }
      
      // Shuffle the prompts
      for (let i = validPrompts.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [validPrompts[i], validPrompts[j]] = [validPrompts[j], validPrompts[i]];
      }
      
      // Try to get one of each color
      const result = [];
      const usedColors = new Set();
      
      for (const prompt of validPrompts) {
        if (!usedColors.has(prompt.type) && result.length < 3) {
          result.push(prompt);
          usedColors.add(prompt.type);
        }
      }
      
      // If we don't have 3 prompts yet, add more regardless of color
      if (result.length < 3) {
        for (const prompt of validPrompts) {
          if (!result.includes(prompt) && result.length < 3) {
            result.push(prompt);
          }
        }
      }
      
      debug(`Returning ${result.length} shuffled prompts`);
      return result;
    } catch (error) {
      debug('Error in getPrompts:', error);
      // Return empty array if there's an error
      return [];
    }
  }
  
  /**
   * Clean up resources
   */
  public cleanup() {
    if (this.generationInterval) {
      clearInterval(this.generationInterval);
    }
  }
} 