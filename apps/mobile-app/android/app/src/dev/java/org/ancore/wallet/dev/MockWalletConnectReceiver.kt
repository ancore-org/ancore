package org.ancore.wallet.dev

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.facebook.react.ReactApplication
import com.facebook.react.modules.core.DeviceEventManagerModule

/**
 * Dev-only receiver for Maestro e2e tests. Forwards adb broadcast intents to JS as
 * `MockWalletConnectRequest` events consumed by WalletKitProvider.
 */
class MockWalletConnectReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val request = intent.getStringExtra("request") ?: return
        val application = context.applicationContext as? ReactApplication ?: return
        val reactContext =
            application.reactNativeHost.reactInstanceManager.currentReactContext ?: return

        reactContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit("MockWalletConnectRequest", request)
    }
}
