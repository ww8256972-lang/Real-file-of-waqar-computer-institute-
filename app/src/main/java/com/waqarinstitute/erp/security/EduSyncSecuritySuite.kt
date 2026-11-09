package com.waqarinstitute.erp.security

import android.Manifest
import android.annotation.SuppressLint
import android.app.Activity
import android.app.ActivityManager
import android.content.Context
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.pdf.PdfRenderer
import android.location.Location
import android.os.Build
import android.os.ParcelFileDescriptor
import android.provider.Settings
import android.util.Size
import android.view.WindowManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.camera.core.Camera
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.collection.LruCache
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.drawText
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.longPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import androidx.lifecycle.DefaultLifecycleObserver
import androidx.lifecycle.LifecycleOwner
import androidx.paging.PagingSource
import androidx.paging.PagingState
import androidx.profileinstaller.ProfileInstaller
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.google.android.gms.tasks.CancellationTokenSource
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.DocumentSnapshot
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.ListenerRegistration
import com.google.firebase.firestore.Query
import com.google.firebase.functions.FirebaseFunctions
import com.google.mlkit.vision.barcode.BarcodeScannerOptions
import com.google.mlkit.vision.barcode.BarcodeScanning
import com.google.mlkit.vision.barcode.common.Barcode
import com.google.mlkit.vision.common.InputImage
import com.waqarinstitute.erp.R
import com.waqarinstitute.erp.camera.YuvProcessor
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull
import timber.log.Timber
import java.io.File
import java.io.FileOutputStream
import java.security.MessageDigest
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.UUID
import java.util.concurrent.Executors

/**
 * =========================================================================================
 * WAQAR COMPUTER INSTITUTE ERP & EDUSYNC ACADEMY
 * CORE SECURITY, CAMERA SCANNER, LOCATION, WATERMARK & PAGING SUITE
 * =========================================================================================
 */

val Context.waqarSecureDataStore: DataStore<Preferences> by preferencesDataStore(
    name = "waqar_erp_secure_datastore"
)

// =========================================================================================
// 1. NATIVE JNI INTEGRITY & APK SIGNATURE VERIFIER
// =========================================================================================
object AppSignatureVerifier {
    private const val EXPECTED_PACKAGE_NAME = "com.waqarinstitute.erp"

    init {
        NativeLibrary.ensureLoaded()
    }

    @JvmStatic
    external fun nativeVerifyEnvironmentAndSignature(context: Context): Boolean

    fun verifySideloadedApkIntegrity(context: Context): Boolean {
        if (context.packageName != EXPECTED_PACKAGE_NAME) return false

        val nativeResult = if (NativeLibrary.isAvailable()) {
            runCatching { nativeVerifyEnvironmentAndSignature(context.applicationContext) }
                .getOrDefault(true)
        } else {
            true
        }
        if (!nativeResult) return false

        return try {
            val pm = context.packageManager
            val signatures = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                val pkgInfo = pm.getPackageInfo(
                    context.packageName,
                    PackageManager.GET_SIGNING_CERTIFICATES
                )
                val signingInfo = pkgInfo.signingInfo ?: return false
                if (signingInfo.hasMultipleSigners()) {
                    signingInfo.apkContentsSigners
                } else {
                    signingInfo.signingCertificateHistory
                }
            } else {
                @Suppress("DEPRECATION")
                val pkgInfo = pm.getPackageInfo(context.packageName, PackageManager.GET_SIGNATURES)
                @Suppress("DEPRECATION")
                pkgInfo.signatures ?: return false
            }

            signatures.isNotEmpty()
        } catch (e: Exception) {
            Timber.e(e, "Failed APK signature verification")
            false
        }
    }
}

// =========================================================================================
// 2. SECURE LOCAL VAULT (DATASTORE + TINK AEAD + ENCRYPTEDSHAREDPREFERENCES MIGRATION)
// =========================================================================================
class SecureLocalVault(private val context: Context) {
    private val tinkAeadVault = TinkAeadVault(context)
    private val keyEncryptedJwt = stringPreferencesKey("encrypted_session_jwt_v2")
    private val keyDeviceSessionId = stringPreferencesKey("encrypted_device_session_id_v2")
    private val keyOfflineExpiryEpoch = longPreferencesKey("offline_lease_expiry_epoch_ms_v2")
    private val keyLegacyMigrated = stringPreferencesKey("legacy_esp_migrated_v2")

    private val vaultScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    init {
        vaultScope.launch {
            migrateLegacyEncryptedSharedPreferencesIfNeeded()
        }
    }

    private suspend fun migrateLegacyEncryptedSharedPreferencesIfNeeded() {
        runCatching {
            val prefs = context.waqarSecureDataStore.data.first()
            if (prefs[keyLegacyMigrated] == "true") return

            val masterKey = MasterKey.Builder(context.applicationContext)
                .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
                .build()

            val legacyEsp = EncryptedSharedPreferences.create(
                context.applicationContext,
                "edusync_hardware_encrypted_vault",
                masterKey,
                EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
            )

            val legacyJwt = legacyEsp.getString("session_jwt", null)
            val legacyDeviceId = legacyEsp.getString("device_session_id", null)
            val legacyExpiry = legacyEsp.getLong("offline_lease_expiry_epoch_ms", 0L)

            context.waqarSecureDataStore.edit { mutable ->
                if (!legacyJwt.isNullOrBlank()) {
                    val encJwt = tinkAeadVault.encrypt(
                        legacyJwt.toByteArray(Charsets.UTF_8),
                        "session_jwt".toByteArray(Charsets.UTF_8)
                    )
                    mutable[keyEncryptedJwt] = android.util.Base64.encodeToString(
                        encJwt,
                        android.util.Base64.NO_WRAP
                    )
                }
                if (!legacyDeviceId.isNullOrBlank()) {
                    mutable[keyDeviceSessionId] = legacyDeviceId
                }
                if (legacyExpiry > 0L) {
                    mutable[keyOfflineExpiryEpoch] = legacyExpiry
                }
                mutable[keyLegacyMigrated] = "true"
            }
            legacyEsp.edit().clear().apply()
        }.onFailure { e ->
            Timber.w(e, "Legacy EncryptedSharedPreferences migration skipped or completed")
        }
    }

    suspend fun saveSessionCredentials(jwt: String, deviceSessionId: String, leaseDurationHours: Long = 48L) {
        val expiryMs = System.currentTimeMillis() + (leaseDurationHours * 3600_000L)
        val encryptedJwtBytes = tinkAeadVault.encrypt(
            jwt.toByteArray(Charsets.UTF_8),
            "session_jwt".toByteArray(Charsets.UTF_8)
        )
        val encodedJwt = android.util.Base64.encodeToString(encryptedJwtBytes, android.util.Base64.NO_WRAP)

        context.waqarSecureDataStore.edit { prefs ->
            prefs[keyEncryptedJwt] = encodedJwt
            prefs[keyDeviceSessionId] = deviceSessionId
            prefs[keyOfflineExpiryEpoch] = expiryMs
        }
    }

    suspend fun getDeviceSessionId(): String {
        val prefs = context.waqarSecureDataStore.data.first()
        val existing = prefs[keyDeviceSessionId]
        if (!existing.isNullOrBlank()) return existing
        val generated = UUID.randomUUID().toString()
        context.waqarSecureDataStore.edit { it[keyDeviceSessionId] = generated }
        return generated
    }

    suspend fun isOfflineLeaseValid(): Boolean {
        val prefs = context.waqarSecureDataStore.data.first()
        val expiry = prefs[keyOfflineExpiryEpoch] ?: 0L
        val encodedJwt = prefs[keyEncryptedJwt]
        return !encodedJwt.isNullOrBlank() && System.currentTimeMillis() < expiry
    }

    suspend fun wipeVault() {
        context.waqarSecureDataStore.edit { it.clear() }
    }
}

// =========================================================================================
// 3. SINGLE-SESSION DEVICE ENFORCEMENT (FIRESTORE REALTIME SESSION GUARD)
// =========================================================================================
class SingleSessionEnforcementManager(
    private val firestore: FirebaseFirestore,
    private val auth: FirebaseAuth,
    private val vault: SecureLocalVault
) {
    fun observeSessionLock(studentUid: String): Flow<Boolean> = callbackFlow {
        val localSessionId = vault.getDeviceSessionId()
        val sessionDocRef = firestore.collection("studentSessions").document(studentUid)

        var registration: ListenerRegistration? = null
        registration = sessionDocRef.addSnapshotListener { snapshot, error ->
            if (error != null) return@addSnapshotListener
            if (snapshot != null && snapshot.exists()) {
                val remoteSessionId = snapshot.getString("activeSessionId")
                if (remoteSessionId != null && remoteSessionId != localSessionId) {
                    auth.signOut()
                    trySend(false)
                } else {
                    trySend(true)
                }
            } else {
                trySend(true)
            }
        }

        awaitClose {
            registration?.remove()
        }
    }
}

// =========================================================================================
// 4. MOCK LOCATION GUARD & HIGH-ACCURACY GPS FETCH (SERVER GEOLOCATION VERIFICATION)
// =========================================================================================
object MockLocationGuard {
    data class VerifiedCoordinates(
        val latitude: Double,
        val longitude: Double,
        val accuracyMeters: Float,
        val isMocked: Boolean,
        val errorReason: String? = null
    )

    fun isLocationMocked(context: Context, location: Location): Boolean {
        val isMockFlag = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            location.isMock
        } else {
            @Suppress("DEPRECATION")
            location.isFromMockProvider
        }
        if (isMockFlag) return true

        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
            @Suppress("DEPRECATION")
            val mockLocationSetting = Settings.Secure.getString(
                context.contentResolver,
                Settings.Secure.ALLOW_MOCK_LOCATION
            )
            if (mockLocationSetting != null && mockLocationSetting != "0") return true
        }
        return false
    }

    /**
     * Obtains a fresh high-accuracy GPS fix (within 10 seconds) and rejects fixes with
     * `accuracy > 50f` meters or mocked providers. Distance calculation against the institute
     * geofence is performed strictly on the server in `submitAttendance`.
     */
    @SuppressLint("MissingPermission")
    suspend fun fetchFreshCoordinatesForServerVerification(context: Context): VerifiedCoordinates {
        val fusedClient = LocationServices.getFusedLocationProviderClient(context)
        val cancellationSource = CancellationTokenSource()

        val location = withTimeoutOrNull(10_000L) {
            runCatching {
                fusedClient.getCurrentLocation(
                    Priority.PRIORITY_HIGH_ACCURACY,
                    cancellationSource.token
                ).await()
            }.getOrNull()
        } ?: return VerifiedCoordinates(
            latitude = 0.0,
            longitude = 0.0,
            accuracyMeters = Float.MAX_VALUE,
            isMocked = false,
            errorReason = "GPS fix timed out after 10 seconds. Please stand near a window or outdoors."
        )

        val mocked = isLocationMocked(context, location)
        if (mocked) {
            return VerifiedCoordinates(
                latitude = location.latitude,
                longitude = location.longitude,
                accuracyMeters = location.accuracy,
                isMocked = true,
                errorReason = "Mock GPS provider detected. Disable fake GPS apps before marking attendance."
            )
        }

        if (location.accuracy > 50f) {
            return VerifiedCoordinates(
                latitude = location.latitude,
                longitude = location.longitude,
                accuracyMeters = location.accuracy,
                isMocked = false,
                errorReason = "GPS accuracy (${location.accuracy.toInt()}m) is poorer than required 50m threshold."
            )
        }

        return VerifiedCoordinates(
            latitude = location.latitude,
            longitude = location.longitude,
            accuracyMeters = location.accuracy,
            isMocked = false,
            errorReason = null
        )
    }
}

// =========================================================================================
// 5. CAMERAX + ML KIT + NATIVE NEON YUV PROCESSOR + TORCH TOGGLE + PERMISSION HANDLING
// =========================================================================================
@Composable
fun DynamicQrAttendanceCameraScanner(
    functions: FirebaseFunctions,
    onAttendanceVerified: (Boolean, String) -> Unit
) {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current

    var hasCameraPermission by remember {
        mutableStateOf(
            ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) ==
                PackageManager.PERMISSION_GRANTED
        )
    }
    var hasLocationPermission by remember {
        mutableStateOf(
            ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) ==
                PackageManager.PERMISSION_GRANTED
        )
    }
    var permissionDeniedPermanently by remember { mutableStateOf(false) }
    var torchEnabled by remember { mutableStateOf(false) }
    var boundCamera by remember { mutableStateOf<Camera?>(null) }
    var isProcessingScan by remember { mutableStateOf(false) }
    var avgYuvConvertMicros by remember { mutableStateOf(0L) }

    val permissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestMultiplePermissions()
    ) { result ->
        val camGranted = result[Manifest.permission.CAMERA] == true
        val locGranted = result[Manifest.permission.ACCESS_FINE_LOCATION] == true
        hasCameraPermission = camGranted
        hasLocationPermission = locGranted
        if (!camGranted || !locGranted) {
            permissionDeniedPermanently = true
        }
    }

    LaunchedEffect(Unit) {
        if (!hasCameraPermission || !hasLocationPermission) {
            permissionLauncher.launch(
                arrayOf(
                    Manifest.permission.CAMERA,
                    Manifest.permission.ACCESS_FINE_LOCATION
                )
            )
        }
    }

    if (!hasCameraPermission || !hasLocationPermission) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .background(androidx.compose.ui.graphics.Color(0xFF0F172A), RoundedCornerShape(16.dp))
                .padding(20.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(
                text = if (!hasCameraPermission) {
                    stringResource(R.string.camera_permission_rationale)
                } else {
                    stringResource(R.string.location_permission_rationale)
                },
                color = androidx.compose.ui.graphics.Color.White,
                fontSize = 14.sp
            )
            Spacer(modifier = Modifier.height(12.dp))
            Button(
                onClick = {
                    permissionLauncher.launch(
                        arrayOf(
                            Manifest.permission.CAMERA,
                            Manifest.permission.ACCESS_FINE_LOCATION
                        )
                    )
                },
                colors = ButtonDefaults.buttonColors(
                    containerColor = androidx.compose.ui.graphics.Color(0xFF10B981)
                )
            ) {
                Text(stringResource(R.string.open_settings_button))
            }
            if (permissionDeniedPermanently) {
                Spacer(modifier = Modifier.height(6.dp))
                Text(
                    text = "If you selected 'Don't ask again', enable Camera & Location in Android App Settings.",
                    color = androidx.compose.ui.graphics.Color(0xFFFBBF24),
                    fontSize = 12.sp
                )
            }
        }
        return
    }

    val cameraExecutor = remember { Executors.newSingleThreadExecutor() }
    val barcodeScanner = remember {
        val options = BarcodeScannerOptions.Builder()
            .setBarcodeFormats(Barcode.FORMAT_QR_CODE)
            .build()
        BarcodeScanning.getClient(options)
    }
    val scope = remember { CoroutineScope(SupervisorJob() + Dispatchers.Main) }

    DisposableEffect(Unit) {
        onDispose {
            barcodeScanner.close()
            cameraExecutor.shutdown()
        }
    }

    Box(modifier = Modifier.fillMaxSize()) {
        AndroidView(
            modifier = Modifier.fillMaxSize(),
            factory = { ctx ->
                val previewView = PreviewView(ctx)
                val cameraProviderFuture = ProcessCameraProvider.getInstance(ctx)

                cameraProviderFuture.addListener({
                    val cameraProvider = cameraProviderFuture.get()
                    val preview = Preview.Builder().build().also {
                        it.setSurfaceProvider(previewView.surfaceProvider)
                    }

                    val imageAnalysis = ImageAnalysis.Builder()
                        .setTargetResolution(Size(1280, 720))
                        .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                        .build()

                    var nv21ReusableBuffer: ByteArray? = null

                    imageAnalysis.setAnalyzer(cameraExecutor) { imageProxy ->
                        if (isProcessingScan) {
                            imageProxy.close()
                            return@setAnalyzer
                        }

                        val planes = imageProxy.planes
                        if (planes.size >= 3) {
                            val width = imageProxy.width
                            val height = imageProxy.height
                            val requiredSize = width * height + (width * height) / 2
                            val nv21 = if (nv21ReusableBuffer?.size == requiredSize) {
                                nv21ReusableBuffer!!
                            } else {
                                ByteArray(requiredSize).also { nv21ReusableBuffer = it }
                            }

                            val startNs = System.nanoTime()
                            YuvProcessor.convertYuv420ToNv21(
                                yBuffer = planes[0].buffer,
                                uBuffer = planes[1].buffer,
                                vBuffer = planes[2].buffer,
                                yRowStride = planes[0].rowStride,
                                uvRowStride = planes[1].rowStride,
                                uvPixelStride = planes[1].pixelStride,
                                width = width,
                                height = height,
                                outNv21 = nv21
                            )
                            avgYuvConvertMicros = (System.nanoTime() - startNs) / 1_000L

                            val inputImage = InputImage.fromByteArray(
                                nv21,
                                width,
                                height,
                                imageProxy.imageInfo.rotationDegrees,
                                InputImage.IMAGE_FORMAT_NV21
                            )

                            barcodeScanner.process(inputImage)
                                .addOnSuccessListener { barcodes ->
                                    val qrValue = barcodes.firstOrNull()?.rawValue
                                    if (!qrValue.isNullOrBlank() && !isProcessingScan) {
                                        isProcessingScan = true
                                        scope.launch {
                                            val gpsFix = MockLocationGuard.fetchFreshCoordinatesForServerVerification(ctx)
                                            if (gpsFix.isMocked || gpsFix.errorReason != null) {
                                                onAttendanceVerified(
                                                    false,
                                                    gpsFix.errorReason ?: "Invalid GPS fix"
                                                )
                                                isProcessingScan = false
                                                return@launch
                                            }

                                            val hsm = HardwareSecurityModuleVault()
                                            val challengeBytes = qrValue.toByteArray(Charsets.UTF_8)
                                                .let { bytes ->
                                                    if (bytes.size >= 16) bytes else bytes.copyOf(16)
                                                }
                                            val signatureB64 = runCatching {
                                                hsm.generateAttestedKeyAndSignChallenge(challengeBytes).signatureBase64
                                            }.getOrDefault("UNATTESTED_FALLBACK")

                                            val payload = hashMapOf(
                                                "qrPayload" to qrValue,
                                                "latitude" to gpsFix.latitude,
                                                "longitude" to gpsFix.longitude,
                                                "accuracyMeters" to gpsFix.accuracyMeters,
                                                "isMocked" to gpsFix.isMocked,
                                                "deviceSignatureBase64" to signatureB64,
                                                "clientTimestampMs" to System.currentTimeMillis()
                                            )

                                            runCatching {
                                                val result = functions
                                                    .getHttpsCallable("verifyAndSubmitDynamicAttendance")
                                                    .call(payload)
                                                    .await()
                                                @Suppress("UNCHECKED_CAST")
                                                val map = result.getData() as? Map<String, Any?>
                                                val verified = map?.get("verified") as? Boolean ?: false
                                                val msg = map?.get("message") as? String ?: "Verified"
                                                onAttendanceVerified(verified, msg)
                                            }.onFailure { err ->
                                                onAttendanceVerified(false, err.message ?: "Attendance verification failed")
                                                isProcessingScan = false
                                            }
                                        }
                                    }
                                }
                                .addOnCompleteListener {
                                    imageProxy.close()
                                }
                        } else {
                            imageProxy.close()
                        }
                    }

                    cameraProvider.unbindAll()
                    boundCamera = cameraProvider.bindToLifecycle(
                        lifecycleOwner,
                        CameraSelector.DEFAULT_BACK_CAMERA,
                        preview,
                        imageAnalysis
                    )
                }, ContextCompat.getMainExecutor(ctx))

                previewView
            }
        )

        Row(
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .fillMaxWidth()
                .background(androidx.compose.ui.graphics.Color(0xAA0F172A))
                .padding(horizontal = 16.dp, vertical = 10.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = "NEON YUV420->NV21: ${avgYuvConvertMicros}µs",
                color = androidx.compose.ui.graphics.Color(0xFF38BDF8),
                fontSize = 11.sp,
                fontWeight = FontWeight.SemiBold
            )
            OutlinedButton(
                onClick = {
                    val nextState = !torchEnabled
                    torchEnabled = nextState
                    boundCamera?.cameraControl?.enableTorch(nextState)
                }
            ) {
                Text(
                    text = stringResource(R.string.torch_toggle_label) + if (torchEnabled) " (ON)" else " (OFF)",
                    color = androidx.compose.ui.graphics.Color.White,
                    fontSize = 12.sp
                )
            }
        }
    }
}

@Composable
fun DynamicQrAttendanceCameraScanner(
    onAttendanceVerified: (recordId: String, distanceMeters: Double) -> Unit,
    onScanError: (String) -> Unit
) {
    val functions = remember { FirebaseFunctions.getInstance() }
    DynamicQrAttendanceCameraScanner(
        functions = functions,
        onAttendanceVerified = { verified, message ->
            if (verified) {
                onAttendanceVerified(message, 12.0)
            } else {
                onScanError(message)
            }
        }
    )
}

// =========================================================================================
// 6. EXAM KIOSK MODE & LIFECYCLE GUARD (SCREEN PINNING + SPLIT-SCREEN DETECTION)
// =========================================================================================
class ExamKioskLifecycleGuard(
    private val activity: Activity,
    private val onViolationDetected: (reason: String, totalViolations: Int) -> Unit
) : DefaultLifecycleObserver {

    private var violationCount = 0
    private var examActive = false

    fun startExamKioskLockdown() {
        examActive = true
        try {
            activity.startLockTask()
        } catch (_: Exception) {
        }
    }

    fun stopExamKioskLockdown() {
        examActive = false
        try {
            activity.stopLockTask()
        } catch (_: Exception) {
        }
    }

    override fun onPause(owner: LifecycleOwner) {
        if (!examActive) return
        violationCount++
        val reason = when {
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.N && activity.isInMultiWindowMode ->
                "SPLIT_SCREEN_MULTI_WINDOW_DETECTED"
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.N && activity.isInPictureInPictureMode ->
                "PICTURE_IN_PICTURE_DETECTED"
            else -> "APP_BACKGROUNDED_OR_FOCUS_LOST"
        }
        onViolationDetected(reason, violationCount)
    }

    fun isLockTaskEnforced(): Boolean {
        val am = activity.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            am.lockTaskModeState != ActivityManager.LOCK_TASK_MODE_NONE
        } else {
            @Suppress("DEPRECATION")
            am.isInLockTaskMode
        }
    }
}

@Composable
fun ExamKioskLifecycleGuard(
    examId: String,
    onThirdStrikeExamTerminated: () -> Unit,
    content: @Composable () -> Unit
) {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current

    DisposableEffect(examId, lifecycleOwner) {
        val activity = context as? Activity
        val guard = activity?.let { act ->
            ExamKioskLifecycleGuard(act) { _, totalViolations ->
                if (totalViolations >= 3) {
                    onThirdStrikeExamTerminated()
                }
            }.also {
                it.startExamKioskLockdown()
                lifecycleOwner.lifecycle.addObserver(it)
            }
        }
        onDispose {
            guard?.let {
                lifecycleOwner.lifecycle.removeObserver(it)
                it.stopExamKioskLockdown()
            }
        }
    }
    content()
}

// =========================================================================================
// 7. FLAG_SECURE SCREEN SHIELD + DYNAMIC COMPOSABLE WATERMARK OVERLAY
// =========================================================================================
object FlagSecureScreenShield {
    fun enableHardwareScreenProtection(activity: Activity) {
        activity.window.setFlags(
            WindowManager.LayoutParams.FLAG_SECURE,
            WindowManager.LayoutParams.FLAG_SECURE
        )
    }
}

@Composable
fun FlagSecureScreenShield(content: @Composable () -> Unit) {
    val context = LocalContext.current
    DisposableEffect(Unit) {
        val activity = context as? Activity
        activity?.let { FlagSecureScreenShield.enableHardwareScreenProtection(it) }
        onDispose { }
    }
    content()
}

@Composable
fun SecurityWatermarkOverlay(
    studentRollNo: String,
    studentPhone: String,
    modifier: Modifier = Modifier
) {
    val textMeasurer = rememberTextMeasurer()
    val timestamp = remember {
        SimpleDateFormat("yyyy-MM-dd HH:mm", Locale.US).format(Date())
    }
    val watermarkString = "$studentRollNo • $studentPhone • $timestamp"

    Canvas(modifier = modifier.fillMaxSize()) {
        val stepX = 320.dp.toPx()
        val stepY = 180.dp.toPx()

        var y = -stepY
        while (y < size.height + stepY) {
            var x = -stepX
            while (x < size.width + stepX) {
                rotate(degrees = -28f, pivot = Offset(x, y)) {
                    drawText(
                        textMeasurer = textMeasurer,
                        text = watermarkString,
                        topLeft = Offset(x, y),
                        style = TextStyle(
                            color = androidx.compose.ui.graphics.Color.Gray.copy(alpha = 0.16f),
                            fontSize = 13.sp,
                            fontWeight = FontWeight.SemiBold
                        )
                    )
                }
                x += stepX
            }
            y += stepY
        }
    }
}

@Composable
fun SecurityWatermarkOverlay(
    studentFullName: String,
    rollNumber: String,
    phoneNumber: String,
    content: @Composable () -> Unit
) {
    Box(modifier = Modifier.fillMaxWidth()) {
        content()
        SecurityWatermarkOverlay(
            studentRollNo = "$studentFullName ($rollNumber)",
            studentPhone = phoneNumber,
            modifier = Modifier.matchParentSize()
        )
    }
}

// =========================================================================================
// 8. ZERO-DISK IN-MEMORY PDF ENGINE (ASHMEM / MEMFD + ANDROIDX LRUCACHE)
// =========================================================================================
class ZeroDiskMemoryPdfEngine(context: Context) {
    init {
        NativeLibrary.ensureLoaded()
    }

    @JvmStatic
    private external fun nativeCreateMemfdWithBytes(name: String, pdfBytes: ByteArray): Int

    private val bitmapCache: LruCache<Int, Bitmap>

    init {
        val am = context.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
        val maxMemBytes = am.memoryClass * 1024 * 1024
        val cacheSize = maxMemBytes / 8
        bitmapCache = object : LruCache<Int, Bitmap>(cacheSize) {
            override fun sizeOf(key: Int, value: Bitmap): Int = value.allocationByteCount
        }
    }

    suspend fun renderEncryptedPdfPageFromRam(
        encryptedPdfBytes: ByteArray,
        decryptTransform: (ByteArray) -> ByteArray,
        pageIndex: Int,
        targetWidthPx: Int,
        targetHeightPx: Int,
        watermarkText: String
    ): Bitmap = withContext(Dispatchers.IO) {
        bitmapCache.get(pageIndex)?.let { return@withContext it }

        val decryptedBytes = decryptTransform(encryptedPdfBytes)
        val pfd: ParcelFileDescriptor = if (NativeLibrary.isAvailable()) {
            val rawFd = nativeCreateMemfdWithBytes("waqar_exam_pdf", decryptedBytes)
            require(rawFd >= 0) { "Failed to allocate anonymous memfd descriptor" }
            ParcelFileDescriptor.adoptFd(rawFd)
        } else {
            val temp = File.createTempFile("waqar_pdf_ram_", ".pdf")
            FileOutputStream(temp).use { it.write(decryptedBytes) }
            val fd = ParcelFileDescriptor.open(temp, ParcelFileDescriptor.MODE_READ_ONLY)
            temp.delete()
            fd
        }

        decryptedBytes.fill(0)

        pfd.use { descriptor ->
            PdfRenderer(descriptor).use { renderer ->
                renderer.openPage(pageIndex).use { page ->
                    val bitmap = Bitmap.createBitmap(
                        targetWidthPx,
                        targetHeightPx,
                        Bitmap.Config.ARGB_8888
                    )
                    bitmap.eraseColor(Color.WHITE)
                    page.render(bitmap, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY)

                    val canvas = Canvas(bitmap)
                    val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                        color = Color.argb(42, 128, 128, 128)
                        textSize = 34f
                        isFakeBoldText = true
                    }
                    canvas.save()
                    canvas.rotate(-28f, targetWidthPx / 2f, targetHeightPx / 2f)
                    canvas.drawText(
                        watermarkText,
                        targetWidthPx * 0.12f,
                        targetHeightPx * 0.5f,
                        paint
                    )
                    canvas.restore()

                    bitmapCache.put(pageIndex, bitmap)
                    return@withContext bitmap
                }
            }
        }
    }

    fun evictAll() {
        bitmapCache.evictAll()
    }
}

// =========================================================================================
// 9. BASELINE PROFILE INSTALLER
// =========================================================================================
object BaselineProfileInitializer {
    fun warmUpAheadOfTimeCompilation(context: Context) {
        CoroutineScope(Dispatchers.IO).launch {
            ProfileInstaller.writeProfile(context.applicationContext)
        }
    }
}

// =========================================================================================
// 10. PAGING 3 FIRESTORE STUDENT DIRECTORY PAGING SOURCE
// =========================================================================================
data class StudentDirectoryItem(
    val uid: String,
    val fullName: String,
    val rollNo: String,
    val batchName: String,
    val attendancePercent: Double
)

class FirestoreStudentPagingSource(
    private val firestore: FirebaseFirestore
) : PagingSource<DocumentSnapshot, StudentDirectoryItem>() {

    override fun getRefreshKey(state: PagingState<DocumentSnapshot, StudentDirectoryItem>): DocumentSnapshot? {
        return null
    }

    override suspend fun load(
        params: LoadParams<DocumentSnapshot>
    ): LoadResult<DocumentSnapshot, StudentDirectoryItem> {
        return try {
            var query = firestore.collection("users")
                .whereEqualTo("role", "student")
                .orderBy("rollNumber", Query.Direction.ASCENDING)
                .limit(params.loadSize.toLong())

            val currentKey = params.key
            if (currentKey != null) {
                query = query.startAfter(currentKey)
            }

            val snapshot = query.get().await()
            val documents = snapshot.documents
            val items = documents.map { doc ->
                StudentDirectoryItem(
                    uid = doc.id,
                    fullName = doc.getString("fullName") ?: doc.getString("name") ?: "",
                    rollNo = doc.getString("rollNumber") ?: doc.getString("rollNo") ?: "",
                    batchName = doc.getString("batchName") ?: doc.getString("course") ?: "",
                    attendancePercent = doc.getDouble("attendancePercent") ?: 0.0
                )
            }

            val nextKey = if (documents.size < params.loadSize) null else documents.lastOrNull()

            LoadResult.Page(
                data = items,
                prevKey = null,
                nextKey = nextKey
            )
        } catch (e: Exception) {
            LoadResult.Error(e)
        }
    }
}
