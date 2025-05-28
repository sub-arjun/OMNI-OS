
/**
 * Locale Polyfill to prevent Chromium crashes
 * This module ensures proper locale initialization to avoid crashes in media elements
 */

// Cache for locale operations to avoid repeated initializations
const localeCache = new Map<string, any>();

/**
 * Safe locale initialization with fallback
 */
export function initializeLocale(): void {
  try {
    // Set default document language if not set
    if (typeof document !== 'undefined' && document.documentElement) {
      if (!document.documentElement.lang) {
        document.documentElement.lang = 'en-US';
      }
      if (!document.documentElement.dir) {
        document.documentElement.dir = 'ltr';
      }
    }

    // Initialize Intl APIs with caching
    if (!localeCache.has('numberFormat')) {
      localeCache.set('numberFormat', new Intl.NumberFormat('en-US'));
    }
    if (!localeCache.has('dateTimeFormat')) {
      localeCache.set('dateTimeFormat', new Intl.DateTimeFormat('en-US'));
    }

    // Test locale operations
    const testDate = new Date();
    testDate.toLocaleDateString('en-US');
    testDate.toLocaleTimeString('en-US');
    (1234.5).toLocaleString('en-US');

    // Initialize Intl.Locale if available
    if (typeof Intl.Locale !== 'undefined') {
      try {
        if (!localeCache.has('locale')) {
          localeCache.set('locale', new Intl.Locale('en-US'));
        }
      } catch (e) {
        console.warn('Intl.Locale not fully supported');
      }
    }

    // Initialize DisplayNames if available (used by some media controls)
    if (typeof Intl.DisplayNames !== 'undefined') {
      try {
        if (!localeCache.has('displayNames')) {
          localeCache.set('displayNames', new Intl.DisplayNames(['en'], { type: 'language' }));
        }
      } catch (e) {
        console.warn('Intl.DisplayNames not fully supported');
      }
    }

    // Polyfill for missing locale methods
    polyfillLocaleMethods();

  } catch (error) {
    console.error('Failed to initialize locale:', error);
    // Fallback to basic locale setup
    setupFallbackLocale();
  }
}

/**
 * Polyfill missing locale methods that might be used by media controls
 */
function polyfillLocaleMethods(): void {
  // Ensure toLocaleDateString works
  if (!(Date.prototype.toLocaleDateString as any)._polyfilled) {
    const original = Date.prototype.toLocaleDateString;
    Date.prototype.toLocaleDateString = function(locales?: string | string[], options?: Intl.DateTimeFormatOptions) {
      try {
        return original.call(this, locales || 'en-US', options);
      } catch (e) {
        // Fallback to simple date string
        return this.toDateString();
      }
    };
    (Date.prototype.toLocaleDateString as any)._polyfilled = true;
  }

  // Ensure toLocaleTimeString works
  if (!(Date.prototype.toLocaleTimeString as any)._polyfilled) {
    const original = Date.prototype.toLocaleTimeString;
    Date.prototype.toLocaleTimeString = function(locales?: string | string[], options?: Intl.DateTimeFormatOptions) {
      try {
        return original.call(this, locales || 'en-US', options);
      } catch (e) {
        // Fallback to simple time string
        return this.toTimeString();
      }
    };
    (Date.prototype.toLocaleTimeString as any)._polyfilled = true;
  }

  // Ensure toLocaleString for numbers works
  if (!(Number.prototype.toLocaleString as any)._polyfilled) {
    const original = Number.prototype.toLocaleString;
    Number.prototype.toLocaleString = function(locales?: string | string[], options?: Intl.NumberFormatOptions) {
      try {
        return original.call(this, locales || 'en-US', options);
      } catch (e) {
        // Fallback to simple string
        return this.toString();
      }
    };
    (Number.prototype.toLocaleString as any)._polyfilled = true;
  }
}

/**
 * Setup fallback locale when Intl is not available or broken
 */
function setupFallbackLocale(): void {
  // Ensure global Intl object exists
  if (typeof window !== 'undefined' && !window.Intl) {
    (window as any).Intl = {};
  }

  // Basic NumberFormat polyfill
  if (!Intl.NumberFormat) {
    (Intl as any).NumberFormat = class {
      private locale: string | string[];
      private options: Intl.NumberFormatOptions;
      
      constructor(locale?: string | string[], options?: Intl.NumberFormatOptions) {
        this.locale = locale || 'en-US';
        this.options = options || {};
      }
      format(value: number): string {
        return value.toString();
      }
    };
  }

  // Basic DateTimeFormat polyfill
  if (!Intl.DateTimeFormat) {
    (Intl as any).DateTimeFormat = class {
      private locale: string | string[];
      private options: Intl.DateTimeFormatOptions;
      
      constructor(locale?: string | string[], options?: Intl.DateTimeFormatOptions) {
        this.locale = locale || 'en-US';
        this.options = options || {};
      }
      format(date: Date): string {
        return date.toDateString();
      }
    };
  }
}

/**
 * Safe locale getter with fallback
 */
export function getSafeLocale(): string {
  try {
    // Try to get browser locale
    const browserLocale = navigator.language || (navigator as any).userLanguage;
    if (browserLocale) {
      // Validate locale format
      if (/^[a-z]{2,3}(-[A-Z]{2})?$/.test(browserLocale)) {
        return browserLocale;
      }
    }
  } catch (e) {
    // Ignore errors
  }
  
  // Return safe default
  return 'en-US';
}

/**
 * Initialize locale before any media element creation
 */
export function initializeMediaLocale(): void {
  try {
    // Force locale initialization in the context where media elements will be created
    const testVideo = document.createElement('video');
    testVideo.lang = 'en-US';
    
    // Test that locale operations work in media context
    const testDate = new Date();
    const formatted = testDate.toLocaleDateString('en-US');
    
    // Clean up test element
    testVideo.remove();
    
    console.log('Media locale initialized successfully');
  } catch (e) {
    console.warn('Media locale initialization warning:', e);
  }
}

// Auto-initialize on module load
initializeLocale(); 