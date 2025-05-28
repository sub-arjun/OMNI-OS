# OMNI Configuration

This directory contains configuration files for the OMNI AI assistant.

## System Prompt Configuration

### `systemPrompt.ts`

This TypeScript file contains the main system prompt that defines OMNI's personality, behavior, and capabilities.

**To edit the system prompt:**

1. Open `systemPrompt.ts` in your code editor
2. Modify the `OMNI_SYSTEM_PROMPT` constant
3. Save the file
4. Rebuild the application:
   ```bash
   npm run build
   ```
5. The new prompt will be bundled with the application

**Key advantages of this approach:**
- ✅ **Reliable in production** - The prompt is bundled directly into the JavaScript code
- ✅ **Type-safe** - TypeScript ensures the prompt is always a string
- ✅ **Fast** - No file system operations needed at runtime
- ✅ **Works everywhere** - No path resolution issues across different platforms
- ✅ **Version controlled** - Changes to the prompt are tracked in git

**Example customization:**

```typescript
export const OMNI_SYSTEM_PROMPT = `Your name is OMNI. You are developed by OMNI AI.

// Add your custom instructions here
You specialize in helping with technical documentation.
You always provide code examples when relevant.

// ... rest of the prompt
`;
```

**Important notes:**
- Always keep the first line identifying OMNI and its creator
- Use template literals (backticks) to allow multi-line strings
- The prompt is loaded once when the service initializes
- Changes require rebuilding the application to take effect 