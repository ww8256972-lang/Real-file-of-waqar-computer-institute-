package com.waqarinstitute.erp.security

import org.conscrypt.Conscrypt
import timber.log.Timber
import java.security.KeyStore
import java.security.Provider
import java.security.Security
import java.security.SecureRandom
import javax.net.ssl.SSLContext
import javax.net.ssl.SSLSocketFactory
import javax.net.ssl.TrustManagerFactory
import javax.net.ssl.X509TrustManager

/**
 * Installs Google Conscrypt (BoringSSL-backed JCA/JSSE provider) at position 1
 * and provides TLS 1.3 SSLSocketFactory + X509TrustManager for OkHttp and gRPC channels.
 */
object ConscryptSecurityProvider {

    @Synchronized
    fun install(): Provider = installAsPrimaryProvider()

    @Synchronized
    fun installAsPrimaryProvider(): Provider {
        val existing = Security.getProviders().firstOrNull { Conscrypt.isConscrypt(it) }
        if (existing != null) {
            return existing
        }
        val provider = Conscrypt.newProvider()
        val position = Security.insertProviderAt(provider, 1)
        Timber.i("Installed Conscrypt TLS provider '%s' at security position %d", provider.name, position)
        return provider
    }

    fun isConscryptFirstProvider(): Boolean {
        val providers = Security.getProviders()
        return providers.isNotEmpty() && Conscrypt.isConscrypt(providers[0])
    }

    fun createTls13SocketFactoryAndTrustManager(): Pair<SSLSocketFactory, X509TrustManager> {
        val provider = installAsPrimaryProvider()
        val tmf = TrustManagerFactory.getInstance(TrustManagerFactory.getDefaultAlgorithm()).apply {
            init(null as KeyStore?)
        }
        val trustManager = tmf.trustManagers.filterIsInstance<X509TrustManager>().first()
        val sslContext = try {
            SSLContext.getInstance("TLSv1.3", provider)
        } catch (_: Exception) {
            SSLContext.getInstance("TLS")
        }
        sslContext.init(null, arrayOf(trustManager), SecureRandom())
        return Pair(sslContext.socketFactory, trustManager)
    }
}
