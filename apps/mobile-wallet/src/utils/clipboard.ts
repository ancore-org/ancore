import { Clipboard } from 'react-native';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';

/**
 * Copy text to clipboard with haptic feedback
 * @param text - The text to copy to clipboard
 * @returns Promise that resolves when the text is copied
 */
export async function copyToClipboardWithHaptic(text: string): Promise<void> {
  try {
    await Clipboard.setString(text);

    // Trigger haptic feedback to confirm the action
    ReactNativeHapticFeedback.trigger('impactLight', {
      enableVibrateFallback: true,
      ignoreAndroidSystemSettings: false,
    });
  } catch (error) {
    // If clipboard fails, still try to provide haptic feedback for the tap
    ReactNativeHapticFeedback.trigger('notificationError', {
      enableVibrateFallback: true,
      ignoreAndroidSystemSettings: false,
    });
    throw error;
  }
}
