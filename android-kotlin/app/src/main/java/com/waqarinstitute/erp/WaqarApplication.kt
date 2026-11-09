package com.waqarinstitute.erp

import android.app.Application
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
import com.waqarinstitute.erp.security.MutualTlsSessionManager
import com.waqarinstitute.erp.security.eduSyncEnterpriseKoinModule
import com.waqarinstitute.erp.worker.StudentSyncWorker
import okhttp3.Cache
import okhttp3.OkHttpClient
import org.koin.android.ext.koin.androidContext
import org.koin.core.context.GlobalContext
import org.koin.core.context.startKoin
import timber.log.Timber
import java.io.File

/**
 * WAQAR COMPUTER INSTITUTE Enterprise Android Application
 * Production Initialization for:
 * - Conscrypt TLS 1.3 JCA Provider
 * - Custom Keystore-Attested Firebase App Check Provider (Debug provider in Debug builds)
 * - Koin Dependency Injection Graph (`eduSyncEnterpriseKoinModule`)
 * - Hardened OkHttpClient + Retrofit ERP API Service
 * - Coil ImageLoader with LRU Memory & 100 MB Disk Cache
 * - WorkManager Periodic Background Student Sync
 */
class WaqarApplication : Application(), ImageLoaderFactory {

    lateinit var okHttpClient: OkHttpClient
        private set

    lateinit var retrofitErpApiService: RetrofitErpApiService
        private set

    override fun onCreate() {
        super.onCreate()

        // 1. Install Conscrypt TLS 1.3 Provider & Timber Logging
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

        // 2. Start Koin DI Graph if not already started by EduSyncAppInitializer
        if (GlobalContext.getOrNull() == null) {
            startKoin {
                androidContext(this@WaqarApplication)
                modules(eduSyncEnterpriseKoinModule)
            }
        }

        // 3. Install Custom Keystore-Attested Firebase App Check Provider
        runCatching {
            CustomKeystoreAppCheckProvider.install(this, isDebugBuild = BuildConfig.DEBUG)
        }

        // 4. Build Hardened TLS 1.3 + Certificate-Pinned OkHttpClient with 50 MB Disk Cache
        val httpCacheDirectory = File(cacheDir, "http_cache")
        val cache = Cache(httpCacheDirectory, 50L * 1024L * 1024L)
        okHttpClient = MutualTlsSessionManager.buildHardenedOkHttpClient(
            context = this,
            enableChuckerInDebug = BuildConfig.DEBUG
        ).newBuilder()
            .cache(cache)
            .build()

        // 5. Build Retrofit ERP API Service backed by the hardened OkHttpClient
        retrofitErpApiService = RetrofitErpApiClient.create(
            baseOkHttpClient = okHttpClient,
            isDebug = BuildConfig.DEBUG
        )

        // 6. Schedule Periodic WorkManager Student Sync
        runCatching {
            StudentSyncWorker.enqueuePeriodicSync(this)
        }

        Timber.i("WaqarApplication initialized with Conscrypt TLS 1.3, App Check, Koin & Coil.")
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
