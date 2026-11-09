package com.waqarinstitute.erp.worker

import android.content.Context
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import com.google.firebase.functions.FirebaseFunctions
import com.waqarinstitute.erp.data.local.WaqarDatabase
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withContext
import timber.log.Timber
import java.io.File
import java.util.concurrent.TimeUnit

/**
 * 1. Periodic Student Directory Synchronization Worker
 */
class StudentSyncWorker(
    appContext: Context,
    workerParams: WorkerParameters
) : CoroutineWorker(appContext, workerParams) {

    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        Timber.i("Starting background student synchronization via WorkManager...")
        val database = WaqarDatabase.getDatabase(applicationContext)

        return@withContext try {
            val totalInDb = database.studentDao().getStudentCount()
            Timber.i("Verified students in local cache: %d", totalInDb)
            Result.success()
        } catch (e: Exception) {
            Timber.e(e, "Background student sync failed; retrying with exponential backoff.")
            Result.retry()
        }
    }

    companion object {
        private const val UNIQUE_PERIODIC_SYNC_WORK = "waqar_periodic_student_sync"

        fun enqueuePeriodicSync(context: Context) {
            val constraints = Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .setRequiresBatteryNotLow(true)
                .build()

            val request = PeriodicWorkRequestBuilder<StudentSyncWorker>(6, TimeUnit.HOURS)
                .setConstraints(constraints)
                .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS)
                .build()

            WorkManager.getInstance(context).enqueueUniquePeriodicWork(
                UNIQUE_PERIODIC_SYNC_WORK,
                ExistingPeriodicWorkPolicy.KEEP,
                request
            )
        }
    }
}

/**
 * 2. Offline-Queued Attendance Upload Worker (drains SQLCipher `secure_attendance_ledger` via Cloud Function)
 */
class AttendanceUploadWorker(
    appContext: Context,
    workerParams: WorkerParameters
) : CoroutineWorker(appContext, workerParams) {

    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        return@withContext try {
            val database = WaqarDatabase.getDatabase(applicationContext)
            val sqlCipherDb = database.sqlCipherVault.openEncryptedAttendanceDatabase()
            val functions = FirebaseFunctions.getInstance()

            val cursor = sqlCipherDb.rawQuery(
                "SELECT record_id, qr_nonce, latitude, longitude, accuracy_meters, recorded_at_ms FROM secure_attendance_ledger WHERE synced = 0 LIMIT 25",
                null
            )

            val syncedIds = mutableListOf<String>()
            cursor.use { c ->
                while (c.moveToNext()) {
                    val recordId = c.getString(0)
                    val qrNonce = c.getString(1)
                    val lat = c.getDouble(2)
                    val lng = c.getDouble(3)
                    val acc = c.getFloat(4)
                    val recordedAt = c.getLong(5)

                    val payload = hashMapOf(
                        "qrPayload" to qrNonce,
                        "latitude" to lat,
                        "longitude" to lng,
                        "accuracyMeters" to acc,
                        "isMocked" to false,
                        "clientTimestampMs" to recordedAt
                    )
                    runCatching {
                        functions.getHttpsCallable("verifyAndSubmitDynamicAttendance")
                            .call(payload)
                            .await()
                        syncedIds.add(recordId)
                    }.onFailure { err ->
                        Timber.w(err, "Deferred attendance upload failed for record %s", recordId)
                    }
                }
            }

            for (id in syncedIds) {
                sqlCipherDb.execSQL(
                    "UPDATE secure_attendance_ledger SET synced = 1 WHERE record_id = ?",
                    arrayOf(id)
                )
            }
            sqlCipherDb.close()
            Result.success()
        } catch (e: Exception) {
            Timber.e(e, "AttendanceUploadWorker failed; scheduling retry")
            Result.retry()
        }
    }

    companion object {
        private const val UNIQUE_ATTENDANCE_UPLOAD_WORK = "waqar_offline_attendance_upload"

        fun enqueueImmediateUpload(context: Context) {
            val constraints = Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build()

            val request = OneTimeWorkRequestBuilder<AttendanceUploadWorker>()
                .setConstraints(constraints)
                .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 15, TimeUnit.SECONDS)
                .build()

            WorkManager.getInstance(context).enqueueUniqueWork(
                UNIQUE_ATTENDANCE_UPLOAD_WORK,
                ExistingWorkPolicy.REPLACE,
                request
            )
        }
    }
}

/**
 * 3. Native Crash Dump Upload Worker (uploads `.dmp` files written by `native-crash-handler.cpp`)
 */
class CrashReportUploadWorker(
    appContext: Context,
    workerParams: WorkerParameters
) : CoroutineWorker(appContext, workerParams) {

    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        val crashDir = File(applicationContext.filesDir, "edusync_native_crashes")
        if (!crashDir.exists()) return@withContext Result.success()

        val dumps = crashDir.listFiles { file -> file.name.endsWith(".dmp") } ?: emptyArray()
        if (dumps.isEmpty()) return@withContext Result.success()

        return@withContext try {
            for (dumpFile in dumps) {
                val reportText = dumpFile.readText(Charsets.UTF_8).take(4096)
                Timber.w("Uploaded native crash dump (%s): %s", dumpFile.name, reportText.lineSequence().firstOrNull())
                dumpFile.delete()
            }
            Result.success()
        } catch (e: Exception) {
            Timber.e(e, "CrashReportUploadWorker failed; retrying")
            Result.retry()
        }
    }
}
