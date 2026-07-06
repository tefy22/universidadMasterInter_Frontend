export interface ApiResult<T> {
  isSuccess: boolean;
  isFailure?: boolean;
  error?: {
    code: string;
    name: string | null;
  };
  value?: T;
}
