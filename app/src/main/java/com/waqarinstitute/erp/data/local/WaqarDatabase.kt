package com.waqarinstitute.erp.data.local

import android.content.ContentValues
import android.content.Context
import android.database.Cursor
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import androidx.paging.PagingSource
import androidx.paging.PagingState
import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase
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
    val createdAt: Long = System.currentTimeMillis(),
    val updatedAt: Long = System.currentTimeMillis(),
    val synced: Int = 1,
    val avatarUrl: String = ""
)

interface StudentDao {
    suspend fun getStudentByUsername(username: String): StudentEntity?

    suspend fun getStudentById(studentId: String): StudentEntity?

    fun getStudentsPaged(): PagingSource<Int, StudentEntity>

    suspend fun getUnsyncedStudents(limit: Int = 50): List<StudentEntity>

    suspend fun markStudentSynced(studentId: String, updatedAt: Long = System.currentTimeMillis())

    suspend fun insertStudent(student: StudentEntity)

    suspend fun insertStudentsBatch(students: List<StudentEntity>)

    fun getStudentCountFlow(): Flow<Int>

    suspend fun getStudentCount(): Int
}

/**
 * Explicit, non-destructive Room / SQLite Migrations.
 * NEVER uses `DROP TABLE IF EXISTS students` or `fallbackToDestructiveMigration()`.
 */
object WaqarDatabaseMigrations {

    /**
     * Migration 1 -> 2: Adds `updatedAt` and `synced` columns to `students` table
     * and creates an index on `username` and `synced` without losing any existing student rows.
     */
    val MIGRATION_1_2: Migration = object : Migration(1, 2) {
        override fun migrate(db: SupportSQLiteDatabase) {
            migrateV1ToV2Sql(
                execSql = { sql -> db.execSQL(sql) },
                hasColumn = { table, col -> supportDbHasColumn(db, table, col) }
            )
        }
    }

    /**
     * Migration 2 -> 3: Adds `avatarUrl` column for Firebase Cloud Storage profile photo paths
     * and creates `local_exam_cache` table without touching existing student or attendance rows.
     */
    val MIGRATION_2_3: Migration = object : Migration(2, 3) {
        override fun migrate(db: SupportSQLiteDatabase) {
            migrateV2ToV3Sql(
                execSql = { sql -> db.execSQL(sql) },
                hasColumn = { table, col -> supportDbHasColumn(db, table, col) }
            )
        }
    }

    val ALL_MIGRATIONS: Array<Migration> = arrayOf(MIGRATION_1_2, MIGRATION_2_3)

    internal fun migrateV1ToV2Sql(
        execSql: (String) -> Unit,
        hasColumn: (String, String) -> Boolean
    ) {
        if (!hasColumn("students", "updatedAt")) {
            execSql("ALTER TABLE students ADD COLUMN updatedAt INTEGER NOT NULL DEFAULT 0")
        }
        if (!hasColumn("students", "synced")) {
            execSql("ALTER TABLE students ADD COLUMN synced INTEGER NOT NULL DEFAULT 1")
        }
        execSql("CREATE INDEX IF NOT EXISTS idx_students_username ON students(username)")
        execSql("CREATE INDEX IF NOT EXISTS idx_students_synced ON students(synced)")
    }

    internal fun migrateV2ToV3Sql(
        execSql: (String) -> Unit,
        hasColumn: (String, String) -> Boolean
    ) {
        if (!hasColumn("students", "avatarUrl")) {
            execSql("ALTER TABLE students ADD COLUMN avatarUrl TEXT NOT NULL DEFAULT ''")
        }
        execSql(
            """
            CREATE TABLE IF NOT EXISTS local_exam_cache (
                examId TEXT PRIMARY KEY NOT NULL,
                courseCode TEXT NOT NULL,
                title TEXT NOT NULL,
                durationMinutes INTEGER NOT NULL,
                totalMarks INTEGER NOT NULL,
                cachedAt INTEGER NOT NULL
            )
            """.trimIndent()
        )
    }

    private fun supportDbHasColumn(db: SupportSQLiteDatabase, table: String, column: String): Boolean {
        db.query("PRAGMA table_info($table)").use { cursor ->
            val nameIdx = cursor.getColumnIndex("name")
            while (cursor.moveToNext()) {
                if (nameIdx >= 0 && cursor.getString(nameIdx).equals(column, ignoreCase = true)) {
                    return true
                }
            }
        }
        return false
    }
}

class WaqarDatabase private constructor(private val appContext: Context) :
    SQLiteOpenHelper(appContext, DATABASE_NAME, null, DATABASE_VERSION) {

    private val countStateFlow = MutableStateFlow(0)

    /**
     * SQLCipher 256-bit encrypted companion vault whose passphrase is generated using hardware entropy
     * and wrapped with `TinkAeadVault` (AES256-GCM backed by Android Keystore MasterKey).
     */
    val sqlCipherVault: SqlCipherExamAttendanceVault by lazy {
        SqlCipherExamAttendanceVault(appContext, TinkAeadVault(appContext))
    }

    private val daoImpl = object : StudentDao {
        override suspend fun getStudentByUsername(username: String): StudentEntity? =
            withContext(Dispatchers.IO) {
                readableDatabase.rawQuery(
                    "SELECT * FROM students WHERE username = ? COLLATE NOCASE LIMIT 1",
                    arrayOf(username.trim())
                ).use { cursor ->
                    if (cursor.moveToFirst()) cursor.toStudentEntity() else null
                }
            }

        override suspend fun getStudentById(studentId: String): StudentEntity? =
            withContext(Dispatchers.IO) {
                readableDatabase.rawQuery(
                    "SELECT * FROM students WHERE studentId = ? COLLATE NOCASE LIMIT 1",
                    arrayOf(studentId.trim())
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

        override suspend fun getUnsyncedStudents(limit: Int): List<StudentEntity> =
            withContext(Dispatchers.IO) {
                val results = mutableListOf<StudentEntity>()
                readableDatabase.rawQuery(
                    "SELECT * FROM students WHERE synced = 0 ORDER BY updatedAt ASC LIMIT ?",
                    arrayOf(limit.toString())
                ).use { cursor ->
                    while (cursor.moveToNext()) {
                        results.add(cursor.toStudentEntity())
                    }
                }
                results
            }

        override suspend fun markStudentSynced(studentId: String, updatedAt: Long): Unit =
            withContext(Dispatchers.IO) {
                val cv = ContentValues().apply {
                    put("synced", 1)
                    put("updatedAt", updatedAt)
                }
                writableDatabase.update(
                    "students",
                    cv,
                    "studentId = ?",
                    arrayOf(studentId)
                )
                Unit
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
                createdAt INTEGER NOT NULL,
                updatedAt INTEGER NOT NULL DEFAULT 0,
                synced INTEGER NOT NULL DEFAULT 1,
                avatarUrl TEXT NOT NULL DEFAULT ''
            )
            """.trimIndent()
        )
        db.execSQL("CREATE INDEX IF NOT EXISTS idx_students_username ON students(username)")
        db.execSQL("CREATE INDEX IF NOT EXISTS idx_students_synced ON students(synced)")
        db.execSQL(
            """
            CREATE TABLE IF NOT EXISTS local_exam_cache (
                examId TEXT PRIMARY KEY NOT NULL,
                courseCode TEXT NOT NULL,
                title TEXT NOT NULL,
                durationMinutes INTEGER NOT NULL,
                totalMarks INTEGER NOT NULL,
                cachedAt INTEGER NOT NULL
            )
            """.trimIndent()
        )
    }

    /**
     * NON-DESTRUCTIVE INCREMENTAL SCHEMA MIGRATION.
     * Preserves 100% of existing student, attendance, and exam records across version upgrades.
     */
    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
        db.beginTransaction()
        try {
            if (oldVersion < 2) {
                WaqarDatabaseMigrations.migrateV1ToV2Sql(
                    execSql = { sql -> db.execSQL(sql) },
                    hasColumn = { table, col -> sqliteHasColumn(db, table, col) }
                )
            }
            if (oldVersion < 3) {
                WaqarDatabaseMigrations.migrateV2ToV3Sql(
                    execSql = { sql -> db.execSQL(sql) },
                    hasColumn = { table, col -> sqliteHasColumn(db, table, col) }
                )
            }
            db.setTransactionSuccessful()
        } finally {
            db.endTransaction()
        }
    }

    private fun sqliteHasColumn(db: SQLiteDatabase, table: String, column: String): Boolean {
        db.rawQuery("PRAGMA table_info($table)", null).use { cursor ->
            val nameIdx = cursor.getColumnIndex("name")
            while (cursor.moveToNext()) {
                if (nameIdx >= 0 && cursor.getString(nameIdx).equals(column, ignoreCase = true)) {
                    return true
                }
            }
        }
        return false
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
        put("updatedAt", updatedAt)
        put("synced", synced)
        put("avatarUrl", avatarUrl)
    }

    private fun Cursor.toStudentEntity(): StudentEntity {
        val updatedAtIdx = getColumnIndex("updatedAt")
        val syncedIdx = getColumnIndex("synced")
        val avatarUrlIdx = getColumnIndex("avatarUrl")
        val createdAtVal = getLong(getColumnIndexOrThrow("createdAt"))
        return StudentEntity(
            studentId = getString(getColumnIndexOrThrow("studentId")),
            username = getString(getColumnIndexOrThrow("username")),
            fullName = getString(getColumnIndexOrThrow("fullName")),
            courseCode = getString(getColumnIndexOrThrow("courseCode")),
            batchCode = getString(getColumnIndexOrThrow("batchCode")),
            branchCode = getString(getColumnIndexOrThrow("branchCode")),
            attendancePercentage = getDouble(getColumnIndexOrThrow("attendancePercentage")),
            feeStatus = getString(getColumnIndexOrThrow("feeStatus")),
            qrToken = getString(getColumnIndexOrThrow("qrToken")),
            createdAt = createdAtVal,
            updatedAt = if (updatedAtIdx >= 0 && !isNull(updatedAtIdx)) getLong(updatedAtIdx) else createdAtVal,
            synced = if (syncedIdx >= 0 && !isNull(syncedIdx)) getInt(syncedIdx) else 1,
            avatarUrl = if (avatarUrlIdx >= 0 && !isNull(avatarUrlIdx)) getString(avatarUrlIdx) else ""
        )
    }

    companion object {
        const val DATABASE_NAME = "waqar_enterprise_100k_v2.db"
        const val DATABASE_VERSION = 3

        @Volatile
        private var INSTANCE: WaqarDatabase? = null

        fun getDatabase(context: Context): WaqarDatabase {
            return INSTANCE ?: synchronized(this) {
                val instance = WaqarDatabase(context.applicationContext)
                INSTANCE = instance
                instance
            }
        }

        fun getInstance(context: Context): WaqarDatabase = getDatabase(context)

        suspend fun getEncryptedAttendanceDatabase(context: Context): net.sqlcipher.database.SQLiteDatabase {
            return getDatabase(context).sqlCipherVault.openEncryptedAttendanceDatabase()
        }
    }
}
