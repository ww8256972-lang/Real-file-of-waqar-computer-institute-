package com.waqarinstitute.erp.data.network

import com.google.android.gms.tasks.Tasks
import com.google.firebase.appcheck.FirebaseAppCheck
import com.google.firebase.auth.FirebaseAuth
import okhttp3.Interceptor
import okhttp3.OkHttpClient
import okhttp3.ResponseBody
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Query
import timber.log.Timber
import java.util.concurrent.TimeUnit

/**
 * Retrofit HTTPS API contract for Waqar Institute Cloud Functions / Cloud Run HTTP endpoints:
 * - Fee receipt verification & PDF metadata
 * - Signed E-Book URL issuance
 * - Short-lived device attestation challenges
 */
interface WaqarErpHttpsApiService {

    @GET("api/v1/feeReceipts")
    suspend fun getStudentFeeReceipts(
        @Query("studentId") studentId: String
    ): ResponseBody

    @GET("api/v1/ebooks/signedUrl")
    suspend fun getProtectedEbookSignedUrl(
        @Query("ebookId") ebookId: String
    ): ResponseBody

    @POST("api/v1/attestation/challenge")
    suspend fun requestAttestationChallenge(
        @Body requestBody: okhttp3.RequestBody
    ): ResponseBody
}

object RetrofitErpNetworkFactory {

    /**
     * Attaches the verified Firebase Auth ID token (`Authorization: Bearer <token>`)
     * and Firebase App Check token (`X-Firebase-AppCheck`) to every outgoing HTTPS call.
     */
    fun createFirebaseAuthAndAppCheckInterceptor(): Interceptor = Interceptor { chain ->
        val builder = chain.request().newBuilder()
        try {
            val currentUser = FirebaseAuth.getInstance().currentUser
            if (currentUser != null) {
                val idTokenResult = Tasks.await(currentUser.getIdToken(false), 5, TimeUnit.SECONDS)
                val idToken = idTokenResult?.token
                if (!idToken.isNullOrBlank()) {
                    builder.header("Authorization", "Bearer $idToken")
                }
            }
        } catch (e: Exception) {
            Timber.d(e, "Skipped Firebase ID token header injection")
        }

        try {
            val appCheckTask = FirebaseAppCheck.getInstance().getAppCheckToken(false)
            val appCheckResult = Tasks.await(appCheckTask, 5, TimeUnit.SECONDS)
            val appCheckToken = appCheckResult?.token
            if (!appCheckToken.isNullOrBlank()) {
                builder.header("X-Firebase-AppCheck", appCheckToken)
            }
        } catch (e: Exception) {
            Timber.d(e, "Skipped App Check token header injection")
        }

        chain.proceed(builder.build())
    }

    /**
     * Creates an `HttpLoggingInterceptor` that logs headers in debug builds while redacting
     * sensitive auth/session headers, and is strictly `Level.NONE` in release builds.
     */
    fun createRedactedLoggingInterceptor(isDebugBuild: Boolean): HttpLoggingInterceptor {
        return HttpLoggingInterceptor { message ->
            Timber.tag("WaqarHttp").d(message)
        }.apply {
            redactHeader("Authorization")
            redactHeader("X-Firebase-AppCheck")
            redactHeader("X-EduSync-Signature")
            redactHeader("X-EduSync-Session-Token")
            level = if (isDebugBuild) {
                HttpLoggingInterceptor.Level.HEADERS
            } else {
                HttpLoggingInterceptor.Level.NONE
            }
        }
    }

    fun createRetrofitService(
        okHttpClient: OkHttpClient,
        baseUrl: String = "https://asia-southeast1-adroit-graph-h2w8r.cloudfunctions.net/"
    ): WaqarErpHttpsApiService {
        return Retrofit.Builder()
            .baseUrl(baseUrl)
            .client(okHttpClient)
            .build()
            .create(WaqarErpHttpsApiService::class.java)
    }
}
