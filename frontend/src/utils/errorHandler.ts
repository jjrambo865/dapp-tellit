/**
 * Comprehensive Error Handling System
 * 
 * This module provides structured error handling with unique IDs showing
 * module, function, and line of origin. It ensures all errors are properly
 * categorized, logged, and can be traced back to their source.
 * 
 * Error ID Format: [MODULE]_[FUNCTION]_[LINE]_[TIMESTAMP]
 */

import { integrationLogger } from './integrationLogger';

export interface ErrorContext {
  module: string;
  function: string;
  line?: number;
  additionalData?: Record<string, any>;
}

export interface StructuredError extends Error {
  errorId: string;
  module: string;
  function: string;
  line?: number;
  timestamp: number;
  context: ErrorContext;
  originalError?: Error;
}

/**
 * Create a structured error with unique ID and comprehensive context
 */
export function createStructuredError(
  message: string,
  context: ErrorContext,
  originalError?: Error
): StructuredError {
  const timestamp = Date.now();
  const errorId = integrationLogger.generateErrorId(context.module, context.function);
  
  const structuredError = new Error(message) as StructuredError;
  structuredError.errorId = errorId;
  structuredError.module = context.module;
  structuredError.function = context.function;
  structuredError.line = context.line;
  structuredError.timestamp = timestamp;
  structuredError.context = context;
  structuredError.originalError = originalError;
  
  // Log the error creation
  integrationLogger.log('ERROR', context.module, context.function, 'Structured error created', {
    errorId,
    message,
    line: context.line,
    additionalData: context.additionalData,
    originalError: originalError?.message
  }, originalError);
  
  return structuredError;
}

// PDA error handling removed - backend handles all PDA generation

/**
 * Handle blockchain transaction errors
 */
export function handleBlockchainError(
  operation: string,
  context: ErrorContext,
  originalError: Error
): StructuredError {
  const message = `Blockchain operation failed: ${operation} - ${originalError.message}`;
  
  return createStructuredError(message, {
    ...context,
    additionalData: {
      ...context.additionalData,
      operation,
      errorType: 'BLOCKCHAIN_ERROR'
    }
  }, originalError);
}

/**
 * Handle validation errors
 */
export function handleValidationError(
  field: string,
  value: any,
  rule: string,
  context: ErrorContext
): StructuredError {
  const message = `Validation failed for ${field}: ${rule}`;
  
  return createStructuredError(message, {
    ...context,
    additionalData: {
      ...context.additionalData,
      field,
      value: typeof value === 'string' ? value.substring(0, 100) : value,
      rule,
      errorType: 'VALIDATION_ERROR'
    }
  });
}

/**
 * Handle network/connection errors
 */
export function handleNetworkError(
  operation: string,
  context: ErrorContext,
  originalError: Error
): StructuredError {
  const message = `Network operation failed: ${operation} - ${originalError.message}`;
  
  return createStructuredError(message, {
    ...context,
    additionalData: {
      ...context.additionalData,
      operation,
      errorType: 'NETWORK_ERROR'
    }
  }, originalError);
}

/**
 * Handle wallet-related errors
 */
export function handleWalletError(
  operation: string,
  context: ErrorContext,
  originalError: Error
): StructuredError {
  const message = `Wallet operation failed: ${operation} - ${originalError.message}`;
  
  return createStructuredError(message, {
    ...context,
    additionalData: {
      ...context.additionalData,
      operation,
      errorType: 'WALLET_ERROR'
    }
  }, originalError);
}

/**
 * Wrap async operations with comprehensive error handling
 */
export async function withErrorHandling<T>(
  operation: () => Promise<T>,
  context: ErrorContext,
  errorHandler?: (error: Error, context: ErrorContext) => StructuredError
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    const structuredError = errorHandler 
      ? errorHandler(error as Error, context)
      : createStructuredError(
          `Operation failed: ${(error as Error).message}`,
          context,
          error as Error
        );
    
    throw structuredError;
  }
}

// PDA consistency validation removed - backend handles all PDA generation

/**
 * Error recovery strategies
 */
export class ErrorRecovery {
  /**
   * Retry operation with exponential backoff
   */
  static async retryWithBackoff<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000,
    context: ErrorContext
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        if (attempt === maxRetries) {
          const structuredError = createStructuredError(
            `Operation failed after ${maxRetries} attempts: ${lastError.message}`,
            {
              ...context,
              additionalData: {
                ...context.additionalData,
                maxRetries,
                finalAttempt: attempt,
                errorType: 'RETRY_EXHAUSTED'
              }
            },
            lastError
          );
          throw structuredError;
        }
        
        const delay = baseDelay * Math.pow(2, attempt - 1);
        integrationLogger.log('WARN', context.module, context.function, `Retry attempt ${attempt} failed, retrying in ${delay}ms`, {
          attempt,
          maxRetries,
          delay,
          error: lastError.message
        });
        
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError!;
  }
  
  // Fallback mechanisms removed - everything is on-chain only
}

/**
 * Error boundary for React components
 */
export class ErrorBoundary extends Error {
  constructor(
    message: string,
    public componentName: string,
    public errorInfo: any,
    context: ErrorContext
  ) {
    super(message);
    this.name = 'ErrorBoundary';
    
    const structuredError = createStructuredError(message, {
      ...context,
      additionalData: {
        ...context.additionalData,
        componentName,
        errorInfo,
        errorType: 'REACT_ERROR_BOUNDARY'
      }
    });
    
    // Copy properties from structured error
    Object.assign(this, structuredError);
  }
}

/**
 * Global error handler for unhandled errors
 */
export function setupGlobalErrorHandling(): void {
  // Handle unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    const error = event.reason;
    const context: ErrorContext = {
      module: 'Global',
      function: 'unhandledrejection',
      additionalData: {
        errorType: 'UNHANDLED_PROMISE_REJECTION',
        promise: event.promise
      }
    };
    
    const structuredError = createStructuredError(
      `Unhandled promise rejection: ${error?.message || 'Unknown error'}`,
      context,
      error
    );
    
    integrationLogger.log('ERROR', 'Global', 'unhandledrejection', 'Unhandled promise rejection', {
      error: structuredError.message,
      errorId: structuredError.errorId
    }, structuredError);
  });
  
  // Handle uncaught errors
  window.addEventListener('error', (event) => {
    const context: ErrorContext = {
      module: 'Global',
      function: 'uncaughtError',
      line: event.lineno,
      additionalData: {
        errorType: 'UNCAUGHT_ERROR',
        filename: event.filename,
        colno: event.colno
      }
    };
    
    const structuredError = createStructuredError(
      `Uncaught error: ${event.message}`,
      context,
      event.error
    );
    
    integrationLogger.log('ERROR', 'Global', 'uncaughtError', 'Uncaught error', {
      error: structuredError.message,
      errorId: structuredError.errorId,
      filename: event.filename,
      line: event.lineno,
      column: event.colno
    }, structuredError);
  });
}

// Initialize global error handling
setupGlobalErrorHandling();
