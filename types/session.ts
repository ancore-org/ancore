export interface SessionState {
  isAuthenticated: boolean;
  token: string | null;
}

export interface SessionActions {
  login: (token: string) => void;
  logout: () => void;
}
