/** React Native global flags available at runtime. */
declare const __DEV__: boolean;

/** Native clipboard module (optional — only available on device). */
declare module '@react-native-clipboard/clipboard' {
  export function setString(value: string): Promise<void>;
  export function getString(): Promise<string>;
}
