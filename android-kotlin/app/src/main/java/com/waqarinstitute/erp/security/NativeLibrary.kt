package com.waqarinstitute.erp.security

import timber.log.Timber
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Single authoritative loader for `libedusync_native_security.so`.
 *
 * Per Master Prompt v2 Section 5.1:
 * - Calls `System.loadLibrary("edusync_native_security")` exactly once.
 * - Never silently swallows errors: records `loadError` and exposes `isLoaded`.
 * - In release builds, if the native library fails to load, sensitive operations
 *   (proctored exams and classroom QR attendance) are blocked loudly and reported.
 */
object NativeLibrary {
    const val LIBRARY_NAME = "edusync_native_security"

    private val loadAttempted = AtomicBoolean(false)

    @Volatile
    var isLoaded: Boolean = false
        private set

    @Volatile
    var loadError: String? = null
        private set

    @Synchronized
    fun ensureLoaded(): Boolean {
        if (loadAttempted.get()) {
            return isLoaded
        }
        loadAttempted.set(true)
        return try {
            System.loadLibrary(LIBRARY_NAME)
            isLoaded = true
            loadError = null
            Timber.i("Native security library '%s' loaded successfully.", LIBRARY_NAME)
            true
        } catch (err: UnsatisfiedLinkError) {
            isLoaded = false
            loadError = err.message ?: "UnsatisfiedLinkError loading $LIBRARY_NAME"
            Timber.e(err, "CRITICAL: Failed to load native security library '%s'", LIBRARY_NAME)
            false
        } catch (err: SecurityException) {
            isLoaded = false
            loadError = err.message ?: "SecurityException loading $LIBRARY_NAME"
            Timber.e(err, "CRITICAL: SecurityException loading native library '%s'", LIBRARY_NAME)
            false
        }
    }

    /**
     * Enforces that the native security library is loaded before allowing sensitive actions
     * (such as starting a proctored exam or submitting geofenced attendance).
     * In release builds (`isDebugBuild == false`), throws a loud `SecurityException` if not loaded.
     */
    fun requireLoadedForSensitiveAction(
        actionName: String,
        isDebugBuild: Boolean,
        onReportFailureToServer: ((String) -> Unit)? = null
    ) {
        if (ensureLoaded()) return
        val detail = "Native library '$LIBRARY_NAME' unavailable for '$actionName': ${loadError ?: "unknown error"}"
        Timber.e(detail)
        onReportFailureToServer?.invoke(detail)
        if (!isDebugBuild) {
            throw SecurityException(
                "Security module failed to load ($LIBRARY_NAME). $actionName is blocked on this device."
            )
        }
    }
}
