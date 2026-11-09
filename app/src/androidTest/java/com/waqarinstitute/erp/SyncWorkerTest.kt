package com.waqarinstitute.erp

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.work.ListenableWorker
import androidx.work.WorkerFactory
import androidx.work.WorkerParameters
import androidx.work.testing.TestListenableWorkerBuilder
import com.waqarinstitute.erp.data.local.StudentEntity
import com.waqarinstitute.erp.data.local.WaqarDatabase
import com.waqarinstitute.erp.worker.AttendanceUploadWorker
import com.waqarinstitute.erp.worker.StudentSyncWorker
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

/**
 * Automated WorkManager Synchronization Test (`SyncWorkerTest`)
 *
 * Verifies:
 * 1. Local unsynced `StudentEntity` rows are queued and tracked via `getUnsyncedStudents`
 *    and `markStudentSynced`.
 * 2. `StudentSyncWorker` and `AttendanceUploadWorker` execute deterministically via
 *    `TestListenableWorkerBuilder` without crashing.
 */
@RunWith(AndroidJUnit4::class)
class SyncWorkerTest {

    @Test
    fun studentDao_tracksUnsyncedAndMarksSynced() = runBlocking {
        val context = ApplicationProvider.getApplicationContext<Context>()
        val db = WaqarDatabase.getInstance(context)
        val dao = db.studentDao()

        val testStudent = StudentEntity(
            studentId = "STU-SYNC-TEST-01",
            fullName = "Aarav Sharma",
            courseCode = "TALLY-PRIME",
            batchCode = "BATCH-B2",
            branchId = "MAIN-BRANCH",
            phone = "9123456780",
            email = "aarav@waqarinstitute.edu",
            parentUserId = "PAR-AARAV",
            attendancePercentage = 92.0,
            feeBalance = 500.0,
            status = "active",
            updatedAtEpochMs = System.currentTimeMillis(),
            synced = false
        )

        dao.insertStudent(testStudent)

        val unsynced = dao.getUnsyncedStudents(limit = 50)
        assertTrue(unsynced.any { it.studentId == "STU-SYNC-TEST-01" })

        val now = System.currentTimeMillis()
        dao.markStudentSynced("STU-SYNC-TEST-01", now)

        val updated = dao.getStudentById("STU-SYNC-TEST-01")
        assertNotNull(updated)
        assertEquals(true, updated?.synced)
    }

    @Test
    fun attendanceUploadWorker_executesCleanlyOnEmptyOrQueuedVault() = runBlocking {
        val context = ApplicationProvider.getApplicationContext<Context>()
        val worker = TestListenableWorkerBuilder<AttendanceUploadWorker>(context).build()
        val result = worker.doWork()
        assertTrue(
            result is ListenableWorker.Result.Success ||
                result is ListenableWorker.Result.Retry
        )
    }

    @Test
    fun studentSyncWorker_executesAndHandlesSyncLifecycle() = runBlocking {
        val context = ApplicationProvider.getApplicationContext<Context>()
        val worker = TestListenableWorkerBuilder<StudentSyncWorker>(context)
            .setWorkerFactory(object : WorkerFactory() {
                override fun createWorker(
                    appContext: Context,
                    workerClassName: String,
                    workerParameters: WorkerParameters
                ): ListenableWorker {
                    return StudentSyncWorker(appContext, workerParameters)
                }
            })
            .build()

        val result = worker.doWork()
        assertTrue(
            result is ListenableWorker.Result.Success ||
                result is ListenableWorker.Result.Retry
        )
    }
}
