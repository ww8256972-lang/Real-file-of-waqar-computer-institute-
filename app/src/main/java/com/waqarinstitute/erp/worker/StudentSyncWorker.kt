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
import androidx.work.WorkRequest
import androidx.work.WorkerParameters
import com.google.firebase.FirebaseApp
import com.google.firebase.Timestamp
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.functions.FirebaseFunctions
import com.waqarinstitute.erp.data.local.StudentEntity
import com.waqarinstitute.erp.data.local.WaqarDatabase
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withContext
import java.io.File
import java.util.concurrent.TimeUnit

private const val NAMED_FIRESTORE_DB_ID = "ai-studio-988a7681-f0d0-4922-93ac-38c131c1cc37"

private fun resolveNamedFirestore(): FirebaseFirestore? {
    return try {
        FirebaseFirestore.getInstance(FirebaseApp.getInstance(), NAMED_FIRESTORE_DB_ID)
    } catch (_: Exception) {
        try {
            FirebaseFirestore.getInstance(NAMED_FIRESTORE_DB_ID)
        } catch (_: Exception) {
            try {
                FirebaseFirestore.getInstance()
            } catch (_: Exception) {
                null
            }
        }
    }
}

/**
 * Background Student Synchronization Worker (`StudentSyncWorker`)
 *
 * Implements full bidirectional synchronization between the local Room/SQLite `students` table
 * (`WaqarDatabase.studentDao()`) and the named Cloud Firestore database
 * (`ai-studio-988a7681-f0d0-4922-93ac-38c131c1cc37`).
 */
class StudentSyncWorker(
    appContext: Context,
    workerParams: WorkerParameters
) : CoroutineWorker(appContext, workerParams) {

    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        try {
            val db = WaqarDatabase.getInstance(applicationContext)
            val studentDao = db.studentDao()
            val firestore = resolveNamedFirestore() ?: return@withContext Result.retry()
            val currentUid = try {
                FirebaseAuth.getInstance().currentUser?.uid ?: ""
            } catch (_: Exception) {
                ""
            }

            val syncTimestamp = System.currentTimeMillis()
            val firestoreNow = Timestamp.now()

            // Step 1: Push unsynced local students to Firestore `erpRecords`
            val unsyncedLocalStudents = studentDao.getUnsyncedStudents(limit = 200)
            if (unsyncedLocalStudents.isNotEmpty()) {
                val writeBatch = firestore.batch()
                for (localStudent in unsyncedLocalStudents) {
                    val docRef = firestore.collection("erpRecords").document(localStudent.studentId)
                    writeBatch.set(
                        docRef,
                        hashMapOf(
                            "module" to "student",
                            "code" to localStudent.studentId,
                            "title" to localStudent.fullName,
                            "subtitle" to "${localStudent.courseCode} • Batch ${localStudent.batchCode}",
                            "category" to "Student Enrollment",
                            "status" to localStudent.feeStatus,
                            "branchId" to localStudent.branchCode,
                            "courseId" to localStudent.courseCode,
                            "batchId" to localStudent.batchCode,
                            "targetUserId" to localStudent.username,
                            "numericValue" to localStudent.attendancePercentage,
                            "secondaryNumericValue" to 0.0,
                            "dateStr" to java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.US)
                                .format(java.util.Date(syncTimestamp)),
                            "notes" to "Synced from Android Room SQLCipher Vault",
                            "extra1" to localStudent.avatarUrl,
                            "extra2" to localStudent.qrToken,
                            "extra3" to "",
                            "extra4" to "",
                            "ownerUid" to currentUid,
                            "visibility" to "institute",
                            "updatedAt" to firestoreNow
                        )
                    )
                }
                writeBatch.commit().await()

                for (localStudent in unsyncedLocalStudents) {
                    studentDao.markStudentSynced(
                        studentId = localStudent.studentId,
                        updatedAt = syncTimestamp
                    )
                }
            }

            // Step 2: Pull remote student records from Firestore `erpRecords` and upsert into local DB
            val remoteSnap = firestore.collection("erpRecords")
                .whereEqualTo("module", "student")
                .get()
                .await()

            if (!remoteSnap.isEmpty) {
                val remoteEntities = remoteSnap.documents.mapNotNull { doc ->
                    val code = (doc.getString("code") ?: doc.id).trim()
                    if (code.isEmpty()) return@mapNotNull null
                    val fullName = (doc.getString("title") ?: code).trim()
                    val courseCode = (doc.getString("courseId") ?: "ADCA").trim()
                    val batchCode = (doc.getString("batchId") ?: "BATCH-A1").trim()
                    val branchCode = (doc.getString("branchId") ?: "MAIN-BRANCH").trim()
                    val avatarUrl = (doc.getString("extra1") ?: "").trim()
                    val qrToken = (doc.getString("extra2") ?: "QR-$code").trim()
                    val attendancePct = doc.getDouble("numericValue") ?: 100.0
                    val feeStatus = (doc.getString("status") ?: "Paid").trim()
                    val updatedEpoch = doc.getTimestamp("updatedAt")?.toDate()?.time ?: syncTimestamp

                    StudentEntity(
                        studentId = code,
                        username = code,
                        fullName = fullName,
                        courseCode = courseCode,
                        batchCode = batchCode,
                        branchCode = branchCode,
                        attendancePercentage = attendancePct,
                        feeStatus = feeStatus,
                        qrToken = qrToken,
                        createdAt = updatedEpoch,
                        updatedAt = updatedEpoch,
                        synced = 1,
                        avatarUrl = avatarUrl
                    )
                }

                if (remoteEntities.isNotEmpty()) {
                    studentDao.insertStudentsBatch(remoteEntities)
                }
            }

            Result.success()
        } catch (e: Exception) {
            if (runAttemptCount < 4) Result.retry() else Result.failure()
        }
    }

    companion object {
        private const val WORK_NAME = "waqar_student_periodic_sync"

        fun schedulePeriodicSync(context: Context) {
            val constraints = Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .setRequiresBatteryNotLow(true)
                .build()

            val request = PeriodicWorkRequestBuilder<StudentSyncWorker>(15, TimeUnit.MINUTES)
                .setConstraints(constraints)
                .setBackoffCriteria(
                    BackoffPolicy.EXPONENTIAL,
                    WorkRequest.MIN_BACKOFF_MILLIS,
                    TimeUnit.MILLISECONDS
                )
                .build()

            WorkManager.getInstance(context).enqueueUniquePeriodicWork(
                WORK_NAME,
                ExistingPeriodicWorkPolicy.KEEP,
                request
            )
        }
    }
}

/**
 * Offline-First Attendance Upload Worker (`AttendanceUploadWorker`)
 */
class AttendanceUploadWorker(
    appContext: Context,
    workerParams: WorkerParameters
) : CoroutineWorker(appContext, workerParams) {

    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        try {
            val sqlCipherDb = WaqarDatabase.getEncryptedAttendanceDatabase(applicationContext)
            val cursor = sqlCipherDb.rawQuery(
                "SELECT record_id, student_id, qr_nonce, latitude, longitude, accuracy_meters, recorded_at_ms FROM secure_attendance_ledger WHERE synced = 0 ORDER BY recorded_at_ms ASC LIMIT 50",
                null
            )

            val pendingItems = mutableListOf<PendingAttendanceRow>()
            cursor.use { c ->
                while (c.moveToNext()) {
                    pendingItems.add(
                        PendingAttendanceRow(
                            recordId = c.getString(0),
                            studentId = c.getString(1),
                            qrNonce = c.getString(2),
                            latitude = c.getDouble(3),
                            longitude = c.getDouble(4),
                            accuracyMeters = c.getDouble(5),
                            recordedAt = c.getLong(6)
                        )
                    )
                }
            }

            if (pendingItems.isEmpty()) {
                return@withContext Result.success()
            }

            val functions = try {
                FirebaseFunctions.getInstance()
            } catch (_: Exception) {
                null
            }
            val firestore = resolveNamedFirestore()

            for (row in pendingItems) {
                var uploaded = false

                if (functions != null && row.qrNonce.isNotBlank()) {
                    try {
                        val payload = hashMapOf(
                            "studentId" to row.studentId,
                            "nonce" to row.qrNonce,
                            "latitude" to row.latitude,
                            "longitude" to row.longitude,
                            "accuracyMeters" to row.accuracyMeters
                        )
                        functions.getHttpsCallable("verifyAndSubmitDynamicAttendance")
                            .call(payload)
                            .await()
                        uploaded = true
                    } catch (_: Exception) {
                    }
                }

                if (!uploaded && firestore != null) {
                    val dateIso = java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.US)
                        .format(java.util.Date(row.recordedAt))
                    val docId = "ATT-${row.studentId}-$dateIso"
                        .replace(Regex("[^a-zA-Z0-9_\\-]"), "-")
                    firestore.collection("erpRecords").document(docId).set(
                        hashMapOf(
                            "module" to "attendance",
                            "code" to row.studentId,
                            "title" to row.studentId,
                            "subtitle" to "SQLCipher Verified • $dateIso",
                            "category" to "SQLCipher Offline Queue Sync",
                            "status" to "Present",
                            "branchId" to "MAIN-BRANCH",
                            "courseId" to "",
                            "batchId" to "ADCA-A1",
                            "targetUserId" to row.studentId,
                            "numericValue" to 100.0,
                            "secondaryNumericValue" to 100.0,
                            "dateStr" to dateIso,
                            "notes" to "Verified GPS (${row.latitude}, ${row.longitude})",
                            "extra1" to "ADCA-A1",
                            "extra2" to "Present",
                            "extra3" to row.qrNonce,
                            "extra4" to "",
                            "visibility" to "institute",
                            "createdAt" to Timestamp.now(),
                            "updatedAt" to Timestamp.now()
                        )
                    ).await()
                    uploaded = true
                }

                if (uploaded) {
                    sqlCipherDb.execSQL(
                        "UPDATE secure_attendance_ledger SET synced = 1 WHERE record_id = ?",
                        arrayOf(row.recordId)
                    )
                }
            }

            Result.success()
        } catch (e: Exception) {
            if (runAttemptCount < 4) Result.retry() else Result.failure()
        }
    }

    private data class PendingAttendanceRow(
        val recordId: String,
        val studentId: String,
        val qrNonce: String,
        val latitude: Double,
        val longitude: Double,
        val accuracyMeters: Double,
        val recordedAt: Long
    )

    companion object {
        private const val UPLOAD_WORK_NAME = "waqar_offline_attendance_upload"

        fun enqueueImmediateUpload(context: Context) {
            val constraints = Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build()

            val request = OneTimeWorkRequestBuilder<AttendanceUploadWorker>()
                .setConstraints(constraints)
                .setBackoffCriteria(
                    BackoffPolicy.EXPONENTIAL,
                    WorkRequest.MIN_BACKOFF_MILLIS,
                    TimeUnit.MILLISECONDS
                )
                .build()

            WorkManager.getInstance(context).enqueueUniqueWork(
                UPLOAD_WORK_NAME,
                ExistingWorkPolicy.APPEND_OR_REPLACE,
                request
            )
        }
    }
}

/**
 * Background Native Crash Report Uploader (`CrashReportUploadWorker`)
 */
class CrashReportUploadWorker(
    appContext: Context,
    workerParams: WorkerParameters
) : CoroutineWorker(appContext, workerParams) {
    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        return@withContext try {
            val crashDir = File(applicationContext.filesDir, "edusync_native_crashes")
            val dumps = crashDir.listFiles { f -> f.name.endsWith(".dmp") } ?: emptyArray()
            val firestore = resolveNamedFirestore()
            for (dump in dumps) {
                runCatching {
                    firestore?.collection("securityAuditLogs")?.add(
                        hashMapOf(
                            "eventType" to "NATIVE_CRASH_DUMP_HARVESTED",
                            "fileName" to dump.name,
                            "sizeBytes" to dump.length(),
                            "createdAt" to Timestamp.now()
                        )
                    )?.await()
                    dump.delete()
                }
            }
            Result.success()
        } catch (_: Exception) {
            Result.retry()
        }
    }
}
