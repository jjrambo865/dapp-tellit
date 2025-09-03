/**
 * Integration Logger - Comprehensive Testing and Tracking System
 * 
 * This utility provides detailed logging and tracking for all frontend-backend
 * interactions to enable thorough troubleshooting and monitoring.
 * 
 * Features:
 * - Unique error identifiers with exact source location
 * - Request/response tracking with timestamps
 * - Performance monitoring
 * - Error categorization and root cause analysis
 * - Error tracking and debugging
 */

export interface LogEntry {
  id: string;
  timestamp: number;
  level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';
  module: string;
  function: string;
  line?: number;
  message: string;
  data?: any;
  error?: Error;
  duration?: number;
}

export interface RequestLog {
  id: string;
  timestamp: number;
  type: 'FRONTEND_REQUEST' | 'BACKEND_RESPONSE' | 'WALLET_OPERATION' | 'BLOCKCHAIN_TRANSACTION';
  operation: string;
  requestData?: any;
  responseData?: any;
  error?: Error;
  duration: number;
  success: boolean;
}

export interface IntegrationStatus {
  walletConnected: boolean;
  backendConnected: boolean;
  programInitialized: boolean;
  lastError?: string;
  lastSuccess?: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
}

class IntegrationLogger {
  private logs: LogEntry[] = [];
  private requestLogs: RequestLog[] = [];
  private integrationStatus: IntegrationStatus = {
    walletConnected: false,
    backendConnected: false,
    programInitialized: false,
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
  };

  /**
   * Generate unique error identifier
   * Format: MODULE_FUNCTION_LINE_TIMESTAMP
   */
  public generateErrorId(module: string, functionName: string, line?: number): string {
    const timestamp = Date.now();
    const lineStr = line ? `_L${line}` : '';
    return `${module}_${functionName}${lineStr}_${timestamp}`;
  }

  /**
   * Log a general entry
   */
  log(
    level: LogEntry['level'],
    module: string,
    functionName: string,
    message: string,
    data?: any,
    error?: Error,
    line?: number
  ): string {
    const id = this.generateErrorId(module, functionName, line);
    const entry: LogEntry = {
      id,
      timestamp: Date.now(),
      level,
      module,
      function: functionName,
      line,
      message,
      data,
      error,
    };

    this.logs.push(entry);
    
    // Console logging for development
    const logMessage = `[${level}] ${module}.${functionName}: ${message}`;
    switch (level) {
      case 'ERROR':
        console.error(logMessage, data, error);
        break;
      case 'WARN':
        console.warn(logMessage, data);
        break;
      case 'DEBUG':
        console.log(logMessage, data);
        break;
      default:
        console.log(logMessage, data);
    }

    return id;
  }

  /**
   * Log a frontend request
   */
  logRequest(
    operation: string,
    requestData?: any,
    responseData?: any,
    error?: Error,
    duration: number = 0,
    success: boolean = true
  ): string {
    const id = this.generateErrorId('FRONTEND', operation);
    const requestLog: RequestLog = {
      id,
      timestamp: Date.now(),
      type: 'FRONTEND_REQUEST',
      operation,
      requestData,
      responseData,
      error,
      duration,
      success,
    };

    this.requestLogs.push(requestLog);
    this.integrationStatus.totalRequests++;
    
    if (success) {
      this.integrationStatus.successfulRequests++;
      this.integrationStatus.lastSuccess = `${operation} completed successfully`;
    } else {
      this.integrationStatus.failedRequests++;
      this.integrationStatus.lastError = `${operation} failed: ${error?.message || 'Unknown error'}`;
    }

    this.log(
      success ? 'INFO' : 'ERROR',
      'FRONTEND',
      operation,
      `${operation} ${success ? 'completed' : 'failed'}`,
      { requestData, responseData, duration },
      error
    );

    return id;
  }

  /**
   * Log a backend response
   */
  logBackendResponse(
    operation: string,
    requestData?: any,
    responseData?: any,
    error?: Error,
    duration: number = 0,
    success: boolean = true
  ): string {
    const id = this.generateErrorId('BACKEND', operation);
    const requestLog: RequestLog = {
      id,
      timestamp: Date.now(),
      type: 'BACKEND_RESPONSE',
      operation,
      requestData,
      responseData,
      error,
      duration,
      success,
    };

    this.requestLogs.push(requestLog);

    this.log(
      success ? 'INFO' : 'ERROR',
      'BACKEND',
      operation,
      `Backend ${operation} ${success ? 'completed' : 'failed'}`,
      { requestData, responseData, duration },
      error
    );

    return id;
  }

  /**
   * Log a wallet operation
   */
  logWalletOperation(
    operation: string,
    requestData?: any,
    responseData?: any,
    error?: Error,
    duration: number = 0,
    success: boolean = true
  ): string {
    const id = this.generateErrorId('WALLET', operation);
    const requestLog: RequestLog = {
      id,
      timestamp: Date.now(),
      type: 'WALLET_OPERATION',
      operation,
      requestData,
      responseData,
      error,
      duration,
      success,
    };

    this.requestLogs.push(requestLog);

    this.log(
      success ? 'INFO' : 'ERROR',
      'WALLET',
      operation,
      `Wallet ${operation} ${success ? 'completed' : 'failed'}`,
      { requestData, responseData, duration },
      error
    );

    return id;
  }

  /**
   * Log a blockchain transaction
   */
  logBlockchainTransaction(
    operation: string,
    transactionId?: string,
    requestData?: any,
    responseData?: any,
    error?: Error,
    duration: number = 0,
    success: boolean = true
  ): string {
    const id = this.generateErrorId('BLOCKCHAIN', operation);
    const requestLog: RequestLog = {
      id,
      timestamp: Date.now(),
      type: 'BLOCKCHAIN_TRANSACTION',
      operation,
      requestData: { ...requestData, transactionId },
      responseData,
      error,
      duration,
      success,
    };

    this.requestLogs.push(requestLog);

    this.log(
      success ? 'INFO' : 'ERROR',
      'BLOCKCHAIN',
      operation,
      `Blockchain ${operation} ${success ? 'completed' : 'failed'}${transactionId ? ` (TX: ${transactionId})` : ''}`,
      { requestData, responseData, duration, transactionId },
      error
    );

    return id;
  }

  /**
   * Update integration status
   */
  updateIntegrationStatus(updates: Partial<IntegrationStatus>): void {
    this.integrationStatus = { ...this.integrationStatus, ...updates };
    this.log('INFO', 'INTEGRATION', 'updateStatus', 'Integration status updated', updates);
  }

  /**
   * Get integration status
   */
  getIntegrationStatus(): IntegrationStatus {
    return { ...this.integrationStatus };
  }

  /**
   * Get all logs
   */
  getAllLogs(): LogEntry[] {
    return [...this.logs];
  }

  /**
   * Get all request logs
   */
  getAllRequestLogs(): RequestLog[] {
    return [...this.requestLogs];
  }

  /**
   * Get logs by module
   */
  getLogsByModule(module: string): LogEntry[] {
    return this.logs.filter(log => log.module === module);
  }

  /**
   * Get request logs by type
   */
  getRequestLogsByType(type: RequestLog['type']): RequestLog[] {
    return this.requestLogs.filter(log => log.type === type);
  }

  /**
   * Get recent logs (last N entries)
   */
  getRecentLogs(count: number = 50): LogEntry[] {
    return this.logs.slice(-count);
  }

  /**
   * Get recent request logs (last N entries)
   */
  getRecentRequestLogs(count: number = 50): RequestLog[] {
    return this.requestLogs.slice(-count);
  }

  /**
   * Clear all logs
   */
  clearLogs(): void {
    this.logs = [];
    this.requestLogs = [];
    this.log('INFO', 'LOGGER', 'clearLogs', 'All logs cleared');
  }

  /**
   * Export logs for debugging
   */
  exportLogs(): string {
    const exportData = {
      timestamp: Date.now(),
      integrationStatus: this.integrationStatus,
      logs: this.logs,
      requestLogs: this.requestLogs,
    };
    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics(): {
    averageResponseTime: number;
    successRate: number;
    totalOperations: number;
    errorCount: number;
  } {
    const successfulRequests = this.requestLogs.filter(log => log.success);
    const failedRequests = this.requestLogs.filter(log => !log.success);
    const totalDuration = this.requestLogs.reduce((sum, log) => sum + log.duration, 0);
    
    return {
      averageResponseTime: this.requestLogs.length > 0 ? totalDuration / this.requestLogs.length : 0,
      successRate: this.requestLogs.length > 0 ? (successfulRequests.length / this.requestLogs.length) * 100 : 0,
      totalOperations: this.requestLogs.length,
      errorCount: failedRequests.length,
    };
  }
}

// Export singleton instance
export const integrationLogger = new IntegrationLogger();
export default integrationLogger;
