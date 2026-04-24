import { SessionState, SessionActions } from "../types/session";

export const createSessionSlice = (set: any): SessionState & SessionActions => ({
  isAuthenticated: false,
  token: null,

  login: (token) =>
    set({
      isAuthenticated: true,
      token,
    }),

  logout: () =>
    set({
      isAuthenticated: false,
      token: null,
    }),
});
