export class ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  timestamp: string;

  constructor(partial: Partial<ApiResponse<T>>) {
    Object.assign(this, partial);
    this.timestamp = new Date().toISOString();
  }

  static success<T>(data: T, message?: string): ApiResponse<T> {
    return new ApiResponse<T>({
      success: true,
      data,
      message,
    });
  }

  static error<T = any>(error: string, message?: string): ApiResponse<T> {
    return new ApiResponse<T>({
      success: false,
      error,
      message,
    });
  }
}
