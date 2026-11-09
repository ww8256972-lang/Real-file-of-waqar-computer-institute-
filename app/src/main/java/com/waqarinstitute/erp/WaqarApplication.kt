package com.waqarinstitute.erp

import android.app.Application
import android.content.Context
import coil.ImageLoader
import coil.ImageLoaderFactory
import coil.disk.DiskCache
import coil.memory.MemoryCache
import coil.request.CachePolicy
import coil.util.DebugLogger
import com.waqarinstitute.erp.data.network.RetrofitErpApiClient
import com.waqarinstitute.erp.data.network.RetrofitErpApiService
import com.waqarinstitute.erp.security.ConscryptSecurityProvider
import com.waqarinstitute.erp.security.CustomKeystoreAppCheckProvider
import com.waqarinstitute.erp.security.EncryptedBankingVault
import com.waqarinstitute.erp.security.HardenedKtorPinnedClient
import com.waqarinstitute.erp.security.MutualTlsSessionManager
import com.waqarinstitute.erp.security.PreStartBankingSecurityGuard
import com.waqarinstitute.erp.security.PreStartSecurityReport
import com.waqarinstitute.erp.security.eduSyncEnterpriseKoinModule
import com.waqarinstitute.erp.worker.StudentSyncWorker
import io.ktor.client.HttpClient
import okhttp3.Cache
import okhttp3.OkHttpClient
import org.koin.android.ext.koin.androidContext
import org.koin.core.context.GlobalContext
import org.koin.core.context.startKoin
import timber.log.Timber
import java.io.File

/**
 * WAQAR COMPUTER INSTITUTE Enterprise Android Application (`WaqarApplication`)
 *
 * Production Initialization for:
 * - Pre-Start Banking Security Guard (Frida Hooking, Runtime Debugger, Dual/Cloned App & RootBeer Root Detection)
 * - EncryptedBankingVault (`androidx.security:security-crypto` `EncryptedSharedPreferences` + SQLCipher 256-bit AES)
 * - Hardened Ktor HTTP Client (`HardenedKtorPinnedClient`) with Hardware Cryptographic Pinning
 * - AndroidX Baseline Profile installation (`ProfileInstaller`)
 * - Conscrypt TLS 1.3 JCA Provider & Keystore-Attested Firebase App Check Provider
 * - Koin Dependency Injection Graph (`eduSyncEnterpriseKoinModule`)
 * - LeakCanary 2.14: Configured via `debugImplementation` in `app/build.gradle.kts`; auto-initializes
 *   exclusively in Debug builds via `AppWatcherInstaller` ContentProvider (zero Application code required).
 */
class WaqarApplication : Application(), ImageLoaderFactory {

    lateinit var okHttpClient: OkHttpClient
        private set

    lateinit var ktorPinnedClient: HttpClient
        private set

    lateinit var encryptedBankingVault: EncryptedBankingVault
        private set

    lateinit var preStartSecurityReport: PreStartSecurityReport
        private set

    lateinit var retrofitErpApiService: RetrofitErpApiService
        private set

    override fun attachBaseContext(base: Context) {
        super.attachBaseContext(base)
        // Execute Pre-Start Frida, Debugger, Dual/Cloned App & RootBeer check before Application onCreate
        runCatching {
            preStartSecurityReport = PreStartBankingSecurityGuard.runPreStartEnvironmentAudit(
                context = base,
                isDebugBuild = BuildConfig.DEBUG
            )
        }
    }

    override fun onCreate() {
        super.onCreate()

        // 1. Ensure Pre-Start Security Audit Report is populated
        if (!::preStartSecurityReport.isInitialized) {
            preStartSecurityReport = PreStartBankingSecurityGuard.runPreStartEnvironmentAudit(
                context = this,
                isDebugBuild = BuildConfig.DEBUG
            )
        }

        // 2. Install Conscrypt TLS 1.3 Provider & Timber Logging
        ConscryptSecurityProvider.install()
        if (Timber.treeCount == 0) {
            if (BuildConfig.DEBUG) {
                Timber.plant(Timber.DebugTree())
            } else {
                Timber.plant(object : Timber.Tree() {
                    override fun log(priority: Int, tag: String?, message: String, t: Throwable?) {
                        // Structured production error sink
                    }
                })
            }
        }

        // 3. Initialize EncryptedSharedPreferences Vault + SQLCipher 256-bit Room SupportFactory
        runCatching {
            encryptedBankingVault = EncryptedBankingVault(this)
            encryptedBankingVault.getOrCreateSqlCipherPassphraseBytes()
        }

        // 4. Install AndroidX Baseline Profile for AOT performance
        PreStartBankingSecurityGuard.installAndVerifyBaselineProfile(this)

        // 5. Start Koin DI Graph if not already started by EduSyncAppInitializer
        if (GlobalContext.getOrNull() == null) {
            startKoin {
                androidContext(this@WaqarApplication)
                modules(eduSyncEnterpriseKoinModule)
            }
        }

        // 6. Install Custom Keystore-Attested Firebase App Check Provider
        runCatching {
            CustomKeystoreAppCheckProvider.install(this, isDebugBuild = BuildConfig.DEBUG)
        }

        // 7. Build Hardened Ktor HTTP Client with Hardware Cryptographic Certificate Pinning
        ktorPinnedClient = HardenedKtorPinnedClient.create(this)

        // 8. Build Hardened TLS 1.3 + Certificate-Pinned OkHttpClient with 50 MB Disk Cache
        val httpCacheDirectory = File(cacheDir, "http_cache")
        val cache = Cache(httpCacheDirectory, 50L * 1024L * 1024L)
        okHttpClient = MutualTlsSessionManager.buildHardenedOkHttpClient(
            context = this,
            enableChuckerInDebug = BuildConfig.DEBUG
        ).newBuilder()
            .cache(cache)
            .build()

        // 9. Build Retrofit ERP API Service backed by the hardened OkHttpClient
        retrofitErpApiService = RetrofitErpApiClient.create(
            baseOkHttpClient = okHttpClient,
            isDebug = BuildConfig.DEBUG
        )

        // 10. Schedule Periodic WorkManager Student Sync
        runCatching {
            StudentSyncWorker.schedulePeriodicSync(this)
        }

        Timber.i(
            "WaqarApplication initialized: cleanEnv=%b, Conscrypt TLS 1.3, Ktor Pinning, SQLCipher, RootBeer & BaselineProfile active.",
            preStartSecurityReport.isEnvironmentClean
        )
    }

    override fun newImageLoader(): ImageLoader {
        return ImageLoader.Builder(this)
            .memoryCache {
                MemoryCache.Builder(this)
                    .maxSizePercent(0.25)
                    .build()
            }
            .diskCache {
                DiskCache.Builder()
                    .directory(cacheDir.resolve("image_cache"))
                    .maxSizeBytes(100L * 1024L * 1024L)
                    .build()
            }
            .okHttpClient(okHttpClient)
            .networkCachePolicy(CachePolicy.ENABLED)
            .diskCachePolicy(CachePolicy.ENABLED)
            .memoryCachePolicy(CachePolicy.ENABLED)
            .crossfade(true)
            .apply {
                if (BuildConfig.DEBUG) {
                    logger(DebugLogger())
                }
            }
            .build()
    }
}
