package com.waqarinstitute.erp.data.local

import android.content.ContentValues
import android.content.Context
import android.database.Cursor
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import androidx.paging.PagingSource
import androidx.paging.PagingState
import com.waqarinstitute.erp.security.SqlCipherExamAttendanceVault
import com.waqarinstitute.erp.security.TinkAeadVault
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.withContext

/**
 * Local Student Record Entity.
 * SECURITY NOTE: Passwords or password hashes are NEVER stored in local SQLite or Firestore;
 * all authentication is handled by Firebase Authentication (`FirebaseAuth`).
 */
data class StudentEntity(
    val studentId: String,
    val username: String,
    val fullName: String,
    val courseCode: String,
    val batchCode: String,
    val branchCode: String,
    val attendancePercentage: Double,
    val feeStatus: String,
    val qrToken: String,
    val createdAt: Long = System.currentTimeMillis()
)

interface StudentDao {
    suspend fun getStudentByUsername(username: String): StudentEntity?

    fun getStudentsPaged(): PagingSource<Int, StudentEntity>

    suspend fun insertStudent(student: StudentEntity)

    suspend fun insertStudentsBatch(students: List<StudentEntity>)

    fun getStudentCountFlow(): Flow<Int>

    suspend fun getStudentCount(): Int
}

class WaqarDatabase private constructor(private val appContext: Context) :
    SQLiteOpenHelper(appContext, "waqar_enterprise_100k_v2.db", null, 2) {

    private val countStateFlow = MutableStateFlow(0)

    /**
     * SQLCipher encrypted companion vault whose passphrase is generated at random and wrapped
     * with `TinkAeadVault` (AES256-GCM backed by Android Keystore).
     */
    val sqlCipherVault: SqlCipherExamAttendanceVault by lazy {
        SqlCipherExamAttendanceVault(appContext, TinkAeadVault(appContext))
    }

    private val daoImpl = object : StudentDao {
        override suspend fun getStudentByUsername(username: String): StudentEntity? =
            withContext(Dispatchers.IO) {
                readableDatabase.rawQuery(
                    "SELECT * FROM students WHERE username = ? LIMIT 1",
                    arrayOf(username)
                ).use { cursor ->
                    if (cursor.moveToFirst()) cursor.toStudentEntity() else null
                }
            }

        override fun getStudentsPaged(): PagingSource<Int, StudentEntity> {
            return object : PagingSource<Int, StudentEntity>() {
                override suspend fun load(params: LoadParams<Int>): LoadResult<Int, StudentEntity> =
                    withContext(Dispatchers.IO) {
                        try {
                            val page = params.key ?: 0
                            val limit = params.loadSize
                            val offset = page * limit
                            val list = mutableListOf<StudentEntity>()
                            readableDatabase.rawQuery(
                                "SELECT * FROM students ORDER BY createdAt DESC LIMIT ? OFFSET ?",
                                arrayOf(limit.toString(), offset.toString())
                            ).use { cursor ->
                                while (cursor.moveToNext()) {
                                    list.add(cursor.toStudentEntity())
                                }
                            }
                            LoadResult.Page(
                                data = list,
                                prevKey = if (page == 0) null else page - 1,
                                nextKey = if (list.size < limit) null else page + 1
                            )
                        } catch (e: Exception) {
                            LoadResult.Error(e)
                        }
                    }

                override fun getRefreshKey(state: PagingState<Int, StudentEntity>): Int? {
                    val anchorPosition = state.anchorPosition ?: return null
                    val anchorPage = state.closestPageToPosition(anchorPosition) ?: return null
                    return anchorPage.prevKey?.plus(1) ?: anchorPage.nextKey?.minus(1)
                }
            }
        }

        override suspend fun insertStudent(student: StudentEntity) = withContext(Dispatchers.IO) {
            writableDatabase.insertWithOnConflict(
                "students",
                null,
                student.toContentValues(),
                SQLiteDatabase.CONFLICT_REPLACE
            )
            refreshCount()
        }

        override suspend fun insertStudentsBatch(students: List<StudentEntity>) =
            withContext(Dispatchers.IO) {
                val db = writableDatabase
                db.beginTransaction()
                try {
                    for (student in students) {
                        db.insertWithOnConflict(
                            "students",
                            null,
                            student.toContentValues(),
                            SQLiteDatabase.CONFLICT_REPLACE
                        )
                    }
                    db.setTransactionSuccessful()
                } finally {
                    db.endTransaction()
                }
                refreshCount()
            }

        override fun getStudentCountFlow(): Flow<Int> = countStateFlow.asStateFlow()

        override suspend fun getStudentCount(): Int = withContext(Dispatchers.IO) {
            queryCountSync()
        }
    }

    init {
        countStateFlow.value = try {
            queryCountSync()
        } catch (_: Exception) {
            0
        }
    }

    override fun onCreate(db: SQLiteDatabase) {
        db.execSQL(
            """
            CREATE TABLE IF NOT EXISTS students (
                studentId TEXT PRIMARY KEY NOT NULL,
                username TEXT NOT NULL,
                fullName TEXT NOT NULL,
                courseCode TEXT NOT NULL,
                batchCode TEXT NOT NULL,
                branchCode TEXT NOT NULL,
                attendancePercentage REAL NOT NULL,
                feeStatus TEXT NOT NULL,
                qrToken TEXT NOT NULL,
                createdAt INTEGER NOT NULL
            )
            """.trimIndent()
        )
    }

    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
        db.execSQL("DROP TABLE IF EXISTS students")
        onCreate(db)
    }

    fun studentDao(): StudentDao = daoImpl

    private fun refreshCount() {
        countStateFlow.value = queryCountSync()
    }

    private fun queryCountSync(): Int {
        readableDatabase.rawQuery("SELECT COUNT(*) FROM students", null).use { cursor ->
            return if (cursor.moveToFirst()) cursor.getInt(0) else 0
        }
    }

    private fun StudentEntity.toContentValues(): ContentValues = ContentValues().apply {
        put("studentId", studentId)
        put("username", username)
        put("fullName", fullName)
        put("courseCode", courseCode)
        put("batchCode", batchCode)
        put("branchCode", branchCode)
        put("attendancePercentage", attendancePercentage)
        put("feeStatus", feeStatus)
        put("qrToken", qrToken)
        put("createdAt", createdAt)
    }

    private fun Cursor.toStudentEntity(): StudentEntity = StudentEntity(
        studentId = getString(getColumnIndexOrThrow("studentId")),
        username = getString(getColumnIndexOrThrow("username")),
        fullName = getString(getColumnIndexOrThrow("fullName")),
        courseCode = getString(getColumnIndexOrThrow("courseCode")),
        batchCode = getString(getColumnIndexOrThrow("batchCode")),
        branchCode = getString(getColumnIndexOrThrow("branchCode")),
        attendancePercentage = getDouble(getColumnIndexOrThrow("attendancePercentage")),
        feeStatus = getString(getColumnIndexOrThrow("feeStatus")),
        qrToken = getString(getColumnIndexOrThrow("qrToken")),
        createdAt = getLong(getColumnIndexOrThrow("createdAt"))
    )

    companion object {
        @Volatile
        private var INSTANCE: WaqarDatabase? = null

        fun getDatabase(context: Context): WaqarDatabase {
            return INSTANCE ?: synchronized(this) {
                val instance = WaqarDatabase(context.applicationContext)
                INSTANCE = instance
                instance
            }
        }
    }
}
