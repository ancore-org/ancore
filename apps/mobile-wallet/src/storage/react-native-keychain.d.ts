/**
 * Minimal ambient declaration for the subset of `react-native-keychain` used by
 * {@link KeychainSecureStoreAdapter}.
 *
 * The native module is only available once the React Native host app (#780) wires
 * in `react-native-keychain`. This package builds and unit-tests as a standalone
 * TypeScript library, so we declare the surface we depend on rather than taking a
 * hard dependency on the native package. The real package ships its own (richer)
 * types and is resolved at runtime on device/simulator; Jest mocks it virtually.
 */
declare module 'react-native-keychain' {
  export interface GenericPasswordResult {
    service: string;
    username: string;
    password: string;
    storage?: string;
  }

  export interface SetOptions {
    service?: string;
    accessGroup?: string;
    accessible?: string;
    accessControl?: string;
    securityLevel?: string;
  }

  export interface GetOptions {
    service?: string;
    accessGroup?: string;
    authenticationPrompt?: string | { title?: string };
  }

  export interface ResetOptions {
    service?: string;
    accessGroup?: string;
  }

  export function setGenericPassword(
    username: string,
    password: string,
    options?: SetOptions
  ): Promise<false | { service: string; storage: string }>;

  export function getGenericPassword(options?: GetOptions): Promise<false | GenericPasswordResult>;

  export function resetGenericPassword(options?: ResetOptions): Promise<boolean>;
}
