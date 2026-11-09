package com.waqarinstitute.erp.ui

import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Assignment
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.ExitToApp
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Image
import androidx.compose.material.icons.filled.Key
import androidx.compose.material.icons.filled.MenuBook
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.QrCodeScanner
import androidx.compose.material.icons.filled.School
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Videocam
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.waqarinstitute.erp.security.DynamicQrAttendanceCameraScanner
import com.waqarinstitute.erp.security.HardwareSecurityModuleVault
import java.security.SecureRandom
import com.waqarinstitute.erp.FullScreenWaterfallAndFishBackground
import com.waqarinstitute.erp.data.BatchDoc
import com.waqarinstitute.erp.data.BranchDoc
import com.waqarinstitute.erp.data.CourseDoc
import com.waqarinstitute.erp.data.ErpRecord
import com.waqarinstitute.erp.data.UserProfile
import com.waqarinstitute.erp.data.WaqarFirebaseRepository
import com.waqarinstitute.erp.data.calculateGrade
import com.waqarinstitute.erp.data.local.StudentEntity
import com.waqarinstitute.erp.data.local.WaqarDatabase
import kotlinx.coroutines.launch

@Composable
fun AdminErpComposeScreen(
    userProfile: UserProfile,
    repository: WaqarFirebaseRepository,
    database: WaqarDatabase,
    branches: List<BranchDoc>,
    courses: List<CourseDoc>,
    batches: List<BatchDoc>,
    erpRecords: List<ErpRecord>,
    cloudUsers: List<UserProfile>,
    onLogout: () -> Unit
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val localStudentCount by database.studentDao().getStudentCountFlow().collectAsState(initial = 0)

    // 19 Admin Sections (Zero "Android Kotlin APK" item in Navigation Bar)
    val adminSections = remember {
        listOf(
            "dashboard" to "Dashboard",
            "students" to "Students & Photo",
            "id_vault" to "Credential Vault",
            "courses" to "Courses",
            "batches" to "Batches",
            "attendance" to "Batch & QR Attendance",
            "examinations" to "50-MCQ Exams",
            "results" to "Results",
            "fees" to "Fees",
            "live_class" to "Agora Live Class",
            "ai_tutor" to "Instant AI Tutor",
            "teachers" to "Teachers",
            "admissions" to "Admissions",
            "certificates" to "Certificates",
            "branches" to "Branches",
            "notifications" to "Notices",
            "messages" to "Messages",
            "staff" to "Staff",
            "settings" to "Settings & Security"
        )
    }

    var activeSection by remember { mutableStateOf("dashboard") }
    var statusBanner by remember { mutableStateOf<String?>(null) }

    // Student Creation (with Native Gallery Photo Picker — separated from Login ID/Password Vault)
    var stuCode by remember { mutableStateOf("") }
    var stuName by remember { mutableStateOf("") }
    var stuGuardian by remember { mutableStateOf("") }
    var stuCourse by remember { mutableStateOf(courses.firstOrNull()?.code ?: "ADCA") }
    var stuBatch by remember { mutableStateOf(batches.firstOrNull()?.code ?: "ADCA-A1") }
    var stuPhotoUri by remember { mutableStateOf<Uri?>(null) }

    val photoPickerLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.GetContent()
    ) { uri: Uri? ->
        if (uri != null) {
            stuPhotoUri = uri
        }
    }

    // Dedicated Credential Vault State (Separated from Student Gallery Photo section)
    var vaultUsername by remember { mutableStateOf("") }
    var vaultPassword by remember { mutableStateOf("") }
    var vaultDisplayName by remember { mutableStateOf("") }
    var vaultRole by remember { mutableStateOf("student") }
    var vaultLinkedId by remember { mutableStateOf("") }

    // Course Form State
    var courseCode by remember { mutableStateOf("") }
    var courseName by remember { mutableStateOf("") }
    var courseCategory by remember { mutableStateOf("Diploma") }
    var courseDuration by remember { mutableStateOf("12 Months") }
    var courseFee by remember { mutableStateOf("6500") }
    var courseSyllabus by remember { mutableStateOf("") }

    // Batch Form State
    var batchCode by remember { mutableStateOf("") }
    var batchName by remember { mutableStateOf("") }
    var batchCourseCode by remember { mutableStateOf(courses.firstOrNull()?.code ?: "ADCA") }
    var batchTeacher by remember { mutableStateOf("Waqar Sir") }
    var batchTiming by remember { mutableStateOf("10:00 - 11:00 (24h)") }
    var batchCapacity by remember { mutableStateOf("30") }

    // Attendance & Whole-Batch Direct Submit State
    var selectedAttBatch by remember { mutableStateOf(batches.firstOrNull()?.code ?: "ADCA-A1") }
    val draftBatchAttendance = remember { mutableStateMapOf<String, String>() }
    var qrScannerDialogOpen by remember { mutableStateOf(false) }

    // 50-MCQ Exam Form State
    var examCode by remember { mutableStateOf("") }
    var examTitle by remember { mutableStateOf("") }
    var examCourse by remember { mutableStateOf(courses.firstOrNull()?.code ?: "ADCA") }
    var examBatch by remember { mutableStateOf(batches.firstOrNull()?.code ?: "ADCA-A1") }
    var examSchedule24h by remember { mutableStateOf("10:00 - 10:30") }

    // Generic ERP Module Form State (Fees, Teachers, Admissions, Certificates, Notices, Messages, Staff)
    var genericTitle by remember { mutableStateOf("") }
    var genericSubtitle by remember { mutableStateOf("") }
    var genericCode by remember { mutableStateOf("") }
    var genericAmount by remember { mutableStateOf("2500") }
    var genericNotes by remember { mutableStateOf("") }

    // Branch Form State
    var branchCodeInput by remember { mutableStateOf("") }
    var branchNameInput by remember { mutableStateOf("") }
    var branchAddressInput by remember { mutableStateOf("") }
    var branchPhoneInput by remember { mutableStateOf("") }

    // Settings & Security State (Admin Own Credentials + Student-Parent Linker + Hardware Keystore Attestation)
    var adminNewUser by remember { mutableStateOf(userProfile.username) }
    var adminNewPass by remember { mutableStateOf("") }
    var linkStuUser by remember { mutableStateOf("") }
    var linkParUser by remember { mutableStateOf("") }
    var strongBoxReportText by remember { mutableStateOf<String?>(null) }

    val studentRecords = remember(erpRecords) { erpRecords.filter { it.module == "student" } }
    val teacherRecords = remember(erpRecords) { erpRecords.filter { it.module == "teacher" } }
    val attendanceRecords = remember(erpRecords) { erpRecords.filter { it.module == "attendance" } }
    val examRecords = remember(erpRecords) { erpRecords.filter { it.module == "exam" } }
    val resultRecords = remember(erpRecords) { erpRecords.filter { it.module == "result" || it.module == "exam_attempt" } }
    val feeRecords = remember(erpRecords) { erpRecords.filter { it.module == "fee" } }

    Scaffold(
        bottomBar = {
            NavigationBar(containerColor = Color.White) {
                listOf(
                    Triple("dashboard", "Home", Icons.Default.Home),
                    Triple("students", "Students", Icons.Default.Person),
                    Triple("attendance", "Attendance", Icons.Default.CheckCircle),
                    Triple("id_vault", "ID Vault", Icons.Default.Key),
                    Triple("settings", "Settings", Icons.Default.Settings)
                ).forEach { (secKey, label, icon) ->
                    NavigationBarItem(
                        selected = activeSection == secKey,
                        onClick = { activeSection = secKey },
                        icon = { Icon(icon, contentDescription = label) },
                        label = { Text(label, fontSize = 11.sp) }
                    )
                }
            }
        }
    ) { innerPadding ->
        Box(modifier = Modifier.fillMaxSize().padding(innerPadding)) {
            FullScreenWaterfallAndFishBackground()

            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(14.dp)
                    .verticalScroll(rememberScrollState())
            ) {
                // Top Header Bar (No "Android Kotlin APK" item in Navigation Bar)
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(20.dp),
                    colors = CardDefaults.cardColors(containerColor = Color(0xFF061445))
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(16.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = "WAQAR INSTITUTE • ADMIN ERP",
                                color = Color(0xFF38BDF8),
                                fontWeight = FontWeight.ExtraBold,
                                fontSize = 17.sp
                            )
                            Text(
                                text = "Welcome, ${userProfile.displayName.ifBlank { "Waqar Ahmed" }} • Cloud Firestore Live",
                                color = Color.White.copy(alpha = 0.85f),
                                fontSize = 12.sp
                            )
                        }
                        IconButton(onClick = onLogout) {
                            Icon(Icons.Default.ExitToApp, contentDescription = "Logout", tint = Color.White)
                        }
                    }
                }

                Spacer(modifier = Modifier.height(10.dp))

                // Horizontal Section Navigation Bar (All 19 Modules — No "Android Kotlin APK" chip)
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    adminSections.forEach { (key, title) ->
                        FilterChip(
                            selected = activeSection == key,
                            onClick = {
                                activeSection = key
                                statusBanner = null
                            },
                            label = {
                                Text(
                                    text = title,
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 12.sp
                                )
                            }
                        )
                    }
                }

                statusBanner?.let { msg ->
                    Spacer(modifier = Modifier.height(8.dp))
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(12.dp),
                        colors = CardDefaults.cardColors(containerColor = Color(0xFFDCFCE7))
                    ) {
                        Text(
                            text = msg,
                            color = Color(0xFF166534),
                            fontWeight = FontWeight.ExtraBold,
                            fontSize = 13.sp,
                            modifier = Modifier.padding(12.dp)
                        )
                    }
                }

                Spacer(modifier = Modifier.height(10.dp))

                when (activeSection) {
                    "dashboard" -> {
                        // KPI Metrics Grid
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                            KpiMetricCard(
                                title = "Total Students",
                                value = "${maxOf(studentRecords.size, localStudentCount)}",
                                subtitle = "Cloud + SQLite Synced",
                                bgColor = Color(0xFF0077B6),
                                modifier = Modifier.weight(1f)
                            )
                            KpiMetricCard(
                                title = "Admin Courses",
                                value = "${courses.size}",
                                subtitle = "${batches.size} Active Batches",
                                bgColor = Color(0xFF0E2A8A),
                                modifier = Modifier.weight(1f)
                            )
                        }
                        Spacer(modifier = Modifier.height(10.dp))
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                            KpiMetricCard(
                                title = "50-MCQ Exams",
                                value = "${examRecords.size}",
                                subtitle = "${resultRecords.size} Graded Attempts",
                                bgColor = Color(0xFF0F766E),
                                modifier = Modifier.weight(1f)
                            )
                            val totalFees = feeRecords.sumOf { it.numericValue }.toInt()
                            KpiMetricCard(
                                title = "Fee Revenue",
                                value = "₹$totalFees",
                                subtitle = "${attendanceRecords.size} Attendance Logs",
                                bgColor = Color(0xFF1D4ED8),
                                modifier = Modifier.weight(1f)
                            )
                        }

                        Spacer(modifier = Modifier.height(12.dp))

                        // Quick Launch Grid for all 19 Admin Modules
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(20.dp),
                            colors = CardDefaults.cardColors(containerColor = Color.White.copy(alpha = 0.95f))
                        ) {
                            Column(modifier = Modifier.padding(16.dp)) {
                                Text(
                                    text = "All 19 Enterprise ERP Modules",
                                    fontWeight = FontWeight.ExtraBold,
                                    fontSize = 16.sp,
                                    color = Color(0xFF03045E)
                                )
                                Spacer(modifier = Modifier.height(10.dp))
                                adminSections.chunked(2).forEach { rowItems ->
                                    Row(
                                        modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
                                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                                    ) {
                                        rowItems.forEach { (secKey, secTitle) ->
                                            Button(
                                                onClick = { activeSection = secKey },
                                                modifier = Modifier.weight(1f).height(46.dp),
                                                shape = RoundedCornerShape(14.dp),
                                                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF0077B6))
                                            ) {
                                                Text(secTitle, fontSize = 12.sp, fontWeight = FontWeight.Bold, maxLines = 1)
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }

                    "students" -> {
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(20.dp),
                            colors = CardDefaults.cardColors(containerColor = Color.White.copy(alpha = 0.95f))
                        ) {
                            Column(modifier = Modifier.padding(16.dp)) {
                                Text(
                                    text = "Create Student Gallery Photo Profile",
                                    fontWeight = FontWeight.ExtraBold,
                                    fontSize = 16.sp,
                                    color = Color(0xFF03045E)
                                )
                                Text(
                                    text = "Note: Login ID & Password creation is located in the separate 'Credential Vault' section.",
                                    fontSize = 12.sp,
                                    color = Color(0xFF0077B6)
                                )
                                Spacer(modifier = Modifier.height(10.dp))

                                OutlinedTextField(
                                    value = stuCode,
                                    onValueChange = { stuCode = it },
                                    label = { Text("Student Roll / ID (e.g. WI2026001)") },
                                    modifier = Modifier.fillMaxWidth(),
                                    singleLine = true
                                )
                                Spacer(modifier = Modifier.height(8.dp))
                                OutlinedTextField(
                                    value = stuName,
                                    onValueChange = { stuName = it },
                                    label = { Text("Student Full Name") },
                                    modifier = Modifier.fillMaxWidth(),
                                    singleLine = true
                                )
                                Spacer(modifier = Modifier.height(8.dp))
                                OutlinedTextField(
                                    value = stuGuardian,
                                    onValueChange = { stuGuardian = it },
                                    label = { Text("Father / Guardian Name") },
                                    modifier = Modifier.fillMaxWidth(),
                                    singleLine = true
                                )
                                Spacer(modifier = Modifier.height(8.dp))
                                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                    OutlinedTextField(
                                        value = stuCourse,
                                        onValueChange = { stuCourse = it },
                                        label = { Text("Course Code") },
                                        modifier = Modifier.weight(1f),
                                        singleLine = true
                                    )
                                    OutlinedTextField(
                                        value = stuBatch,
                                        onValueChange = { stuBatch = it },
                                        label = { Text("Batch Code") },
                                        modifier = Modifier.weight(1f),
                                        singleLine = true
                                    )
                                }

                                Spacer(modifier = Modifier.height(10.dp))

                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                                ) {
                                    OutlinedButton(
                                        onClick = { photoPickerLauncher.launch("image/*") },
                                        modifier = Modifier.weight(1f),
                                        shape = RoundedCornerShape(14.dp)
                                    ) {
                                        Icon(Icons.Default.Image, contentDescription = null)
                                        Spacer(modifier = Modifier.width(6.dp))
                                        Text(if (stuPhotoUri != null) "Photo Selected ✓" else "Upload Gallery Photo")
                                    }
                                    stuPhotoUri?.let { uri ->
                                        AsyncImage(
                                            model = uri,
                                            contentDescription = "Selected Student Photo",
                                            modifier = Modifier.size(48.dp).clip(CircleShape)
                                        )
                                    }
                                }

                                Spacer(modifier = Modifier.height(12.dp))

                                Button(
                                    onClick = {
                                        if (stuName.isNotBlank()) {
                                            val finalCode = stuCode.trim().ifBlank { "WI-${System.currentTimeMillis() % 100000}" }
                                            val cleanName = stuName.trim()
                                            val encodedPhoto = stuPhotoUri?.let { uri ->
                                                encodeGalleryUriToBase64DataUrl(context, uri)
                                            }.orEmpty()
                                            scope.launch {
                                                repository.createErpRecord(
                                                    recordId = finalCode,
                                                    record = ErpRecord(
                                                        id = finalCode,
                                                        module = "student",
                                                        code = finalCode,
                                                        title = cleanName,
                                                        subtitle = "Guardian: ${stuGuardian.trim().ifBlank { "N/A" }}",
                                                        category = stuCourse.trim(),
                                                        status = "Active",
                                                        courseId = stuCourse.trim(),
                                                        batchId = stuBatch.trim(),
                                                        targetUserId = cleanName,
                                                        extra1 = encodedPhoto,
                                                        extra2 = stuGuardian.trim()
                                                    )
                                                )
                                                database.studentDao().insertStudent(
                                                    StudentEntity(
                                                        studentId = finalCode,
                                                        username = finalCode,
                                                        fullName = cleanName,
                                                        courseCode = stuCourse.trim(),
                                                        batchCode = stuBatch.trim(),
                                                        branchCode = "MAIN-BRANCH",
                                                        attendancePercentage = 100.0,
                                                        feeStatus = "Paid",
                                                        qrToken = "QR-$finalCode"
                                                    )
                                                )
                                                statusBanner = "Student '$cleanName' ($finalCode) & Gallery Photo synced to Firestore & Student Portal!"
                                                stuCode = ""
                                                stuName = ""
                                                stuGuardian = ""
                                                stuPhotoUri = null
                                            }
                                        }
                                    },
                                    modifier = Modifier.fillMaxWidth(),
                                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF0077B6)),
                                    shape = RoundedCornerShape(14.dp)
                                ) {
                                    Icon(Icons.Default.Add, contentDescription = null)
                                    Spacer(modifier = Modifier.width(6.dp))
                                    Text("Save Student Profile & Photo to Firestore", fontWeight = FontWeight.Bold)
                                }

                                Spacer(modifier = Modifier.height(14.dp))
                                Text("Enrolled Students (${studentRecords.size})", fontWeight = FontWeight.ExtraBold, color = Color(0xFF03045E))
                                studentRecords.forEach { st ->
                                    Row(
                                        modifier = Modifier.fillMaxWidth().padding(vertical = 6.dp),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Row(
                                            modifier = Modifier.weight(1f),
                                            verticalAlignment = Alignment.CenterVertically
                                        ) {
                                            StudentProfilePhotoAvatar(
                                                photoDataOrUri = st.extra1,
                                                studentName = st.title,
                                                sizeDp = 44
                                            )
                                            Spacer(modifier = Modifier.width(10.dp))
                                            Column {
                                                Text("${st.title} (${st.code})", fontWeight = FontWeight.Bold, fontSize = 14.sp, color = Color(0xFF0F172A))
                                                Text("Course: ${st.courseId} • Batch: ${st.batchId}", fontSize = 12.sp, color = Color(0xFF0077B6))
                                            }
                                        }
                                        IconButton(onClick = { scope.launch { repository.deleteErpRecord(st.id) } }) {
                                            Icon(Icons.Default.Delete, contentDescription = "Delete", tint = Color(0xFFDC2626))
                                        }
                                    }
                                }
                            }
                        }
                    }

                    "id_vault" -> {
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(20.dp),
                            colors = CardDefaults.cardColors(containerColor = Color.White.copy(alpha = 0.95f))
                        ) {
                            Column(modifier = Modifier.padding(16.dp)) {
                                Text(
                                    text = "Credential Vault (Student / Teacher / Parent Login ID & Password)",
                                    fontWeight = FontWeight.ExtraBold,
                                    fontSize = 16.sp,
                                    color = Color(0xFF03045E)
                                )
                                Spacer(modifier = Modifier.height(10.dp))

                                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                    listOf("student", "teacher", "parent").forEach { r ->
                                        FilterChip(
                                            selected = vaultRole == r,
                                            onClick = { vaultRole = r },
                                            label = { Text(r.uppercase(), fontWeight = FontWeight.Bold) }
                                        )
                                    }
                                }

                                Spacer(modifier = Modifier.height(8.dp))
                                OutlinedTextField(
                                    value = vaultDisplayName,
                                    onValueChange = { vaultDisplayName = it },
                                    label = { Text("Full Name") },
                                    modifier = Modifier.fillMaxWidth(),
                                    singleLine = true
                                )
                                Spacer(modifier = Modifier.height(8.dp))
                                OutlinedTextField(
                                    value = vaultUsername,
                                    onValueChange = { vaultUsername = it },
                                    label = { Text("Login Username / Roll ID") },
                                    modifier = Modifier.fillMaxWidth(),
                                    singleLine = true
                                )
                                Spacer(modifier = Modifier.height(8.dp))
                                OutlinedTextField(
                                    value = vaultPassword,
                                    onValueChange = { vaultPassword = it },
                                    label = { Text("Assign Password") },
                                    modifier = Modifier.fillMaxWidth(),
                                    singleLine = true
                                )
                                Spacer(modifier = Modifier.height(8.dp))
                                OutlinedTextField(
                                    value = vaultLinkedId,
                                    onValueChange = { vaultLinkedId = it },
                                    label = { Text("Linked Student / Batch ID (Optional)") },
                                    modifier = Modifier.fillMaxWidth(),
                                    singleLine = true
                                )
                                Spacer(modifier = Modifier.height(12.dp))

                                Button(
                                    onClick = {
                                        if (vaultUsername.isNotBlank() && vaultPassword.isNotBlank()) {
                                            scope.launch {
                                                repository.createOrUpdateInstituteUserViaAdminFunction(
                                                    profile = UserProfile(
                                                        uid = vaultUsername.trim().lowercase(),
                                                        username = vaultUsername.trim(),
                                                        displayName = vaultDisplayName.trim().ifBlank { vaultUsername.trim() },
                                                        role = vaultRole,
                                                        linkedEntityId = vaultLinkedId.trim().ifBlank { vaultUsername.trim().uppercase() }
                                                    ),
                                                    initialPassword = vaultPassword.trim()
                                                )
                                                statusBanner = "Login ID '${vaultUsername.trim()}' provisioned via Firebase Auth Admin Function!"
                                                vaultUsername = ""
                                                vaultPassword = ""
                                                vaultDisplayName = ""
                                            }
                                        }
                                    },
                                    modifier = Modifier.fillMaxWidth(),
                                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF0077B6)),
                                    shape = RoundedCornerShape(14.dp)
                                ) {
                                    Icon(Icons.Default.Key, contentDescription = null)
                                    Spacer(modifier = Modifier.width(6.dp))
                                    Text("Issue Login ID & Password", fontWeight = FontWeight.Bold)
                                }

                                Spacer(modifier = Modifier.height(14.dp))
                                Text("Issued Cloud Credentials (${cloudUsers.size})", fontWeight = FontWeight.ExtraBold, color = Color(0xFF03045E))
                                cloudUsers.forEach { u ->
                                    Card(
                                        modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
                                        shape = RoundedCornerShape(12.dp),
                                        colors = CardDefaults.cardColors(containerColor = Color(0xFFF0F9FF))
                                    ) {
                                        Column(modifier = Modifier.padding(12.dp)) {
                                            Text("${u.displayName} (${u.role.uppercase()})", fontWeight = FontWeight.ExtraBold, fontSize = 14.sp, color = Color(0xFF03045E))
                                            Text("Login ID: ${u.username} • Email: ${u.email.ifBlank { "${u.username}@waqarinstitute.edu" }}", fontSize = 13.sp, color = Color(0xFF0F172A), fontWeight = FontWeight.SemiBold)
                                        }
                                    }
                                }
                            }
                        }
                    }

                    "courses" -> {
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(20.dp),
                            colors = CardDefaults.cardColors(containerColor = Color.White.copy(alpha = 0.95f))
                        ) {
                            Column(modifier = Modifier.padding(16.dp)) {
                                Text("Admin Course Creator (Synced to Student Portal)", fontWeight = FontWeight.ExtraBold, fontSize = 16.sp, color = Color(0xFF03045E))
                                Spacer(modifier = Modifier.height(8.dp))
                                OutlinedTextField(value = courseCode, onValueChange = { courseCode = it }, label = { Text("Course Code (e.g. ADCA, DCA, TALLY)") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
                                Spacer(modifier = Modifier.height(8.dp))
                                OutlinedTextField(value = courseName, onValueChange = { courseName = it }, label = { Text("Course Full Title") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
                                Spacer(modifier = Modifier.height(8.dp))
                                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                    OutlinedTextField(value = courseDuration, onValueChange = { courseDuration = it }, label = { Text("Duration") }, modifier = Modifier.weight(1f), singleLine = true)
                                    OutlinedTextField(value = courseFee, onValueChange = { courseFee = it }, label = { Text("Fee (₹)") }, modifier = Modifier.weight(1f), singleLine = true)
                                }
                                Spacer(modifier = Modifier.height(8.dp))
                                OutlinedTextField(value = courseSyllabus, onValueChange = { courseSyllabus = it }, label = { Text("Syllabus Modules") }, modifier = Modifier.fillMaxWidth())
                                Spacer(modifier = Modifier.height(10.dp))
                                Button(
                                    onClick = {
                                        if (courseCode.isNotBlank() && courseName.isNotBlank()) {
                                            scope.launch {
                                                repository.createCourse(
                                                    CourseDoc(
                                                        code = courseCode.trim().uppercase(),
                                                        name = courseName.trim(),
                                                        category = courseCategory,
                                                        duration = courseDuration.trim(),
                                                        fee = courseFee.toDoubleOrNull() ?: 0.0,
                                                        syllabus = courseSyllabus.trim(),
                                                        description = courseSyllabus.trim()
                                                    )
                                                )
                                                statusBanner = "Course '${courseCode.trim().uppercase()}' published!"
                                                courseCode = ""
                                                courseName = ""
                                                courseSyllabus = ""
                                            }
                                        }
                                    },
                                    modifier = Modifier.fillMaxWidth(),
                                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF0077B6))
                                ) {
                                    Text("Publish Course to Firestore", fontWeight = FontWeight.Bold)
                                }

                                Spacer(modifier = Modifier.height(12.dp))
                                courses.forEach { c ->
                                    Row(
                                        modifier = Modifier.fillMaxWidth().padding(vertical = 6.dp),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Column(modifier = Modifier.weight(1f)) {
                                            Text("${c.code} — ${c.name}", fontWeight = FontWeight.ExtraBold, color = Color(0xFF03045E))
                                            Text("Duration: ${c.duration} • Fee: ₹${c.fee.toInt()}", fontSize = 12.sp, color = Color(0xFF334155))
                                        }
                                        IconButton(onClick = { scope.launch { repository.deleteCourse(c.id) } }) {
                                            Icon(Icons.Default.Delete, contentDescription = "Delete", tint = Color(0xFFDC2626))
                                        }
                                    }
                                }
                            }
                        }
                    }

                    "batches" -> {
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(20.dp),
                            colors = CardDefaults.cardColors(containerColor = Color.White.copy(alpha = 0.95f))
                        ) {
                            Column(modifier = Modifier.padding(16.dp)) {
                                Text("Create 24-Hour Institute Batch", fontWeight = FontWeight.ExtraBold, fontSize = 16.sp, color = Color(0xFF03045E))
                                Spacer(modifier = Modifier.height(8.dp))
                                OutlinedTextField(value = batchCode, onValueChange = { batchCode = it }, label = { Text("Batch Code (e.g. ADCA-A1)") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
                                Spacer(modifier = Modifier.height(8.dp))
                                OutlinedTextField(value = batchName, onValueChange = { batchName = it }, label = { Text("Batch Name") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
                                Spacer(modifier = Modifier.height(8.dp))
                                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                    OutlinedTextField(value = batchCourseCode, onValueChange = { batchCourseCode = it }, label = { Text("Course Code") }, modifier = Modifier.weight(1f), singleLine = true)
                                    OutlinedTextField(value = batchTiming, onValueChange = { batchTiming = it }, label = { Text("24h Timing") }, modifier = Modifier.weight(1f), singleLine = true)
                                }
                                Spacer(modifier = Modifier.height(8.dp))
                                OutlinedTextField(value = batchTeacher, onValueChange = { batchTeacher = it }, label = { Text("Assigned Faculty Name") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
                                Spacer(modifier = Modifier.height(10.dp))
                                Button(
                                    onClick = {
                                        if (batchCode.isNotBlank()) {
                                            scope.launch {
                                                repository.createBatch(
                                                    BatchDoc(
                                                        code = batchCode.trim().uppercase(),
                                                        name = batchName.trim().ifBlank { batchCode.trim().uppercase() },
                                                        courseId = batchCourseCode.trim().uppercase(),
                                                        courseName = batchCourseCode.trim().uppercase(),
                                                        teacherName = batchTeacher.trim(),
                                                        timing = batchTiming.trim(),
                                                        capacity = batchCapacity.toIntOrNull() ?: 30
                                                    )
                                                )
                                                statusBanner = "Batch '${batchCode.trim().uppercase()}' created!"
                                                batchCode = ""
                                                batchName = ""
                                            }
                                        }
                                    },
                                    modifier = Modifier.fillMaxWidth(),
                                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF0077B6))
                                ) {
                                    Text("Create Batch in Firestore", fontWeight = FontWeight.Bold)
                                }

                                Spacer(modifier = Modifier.height(12.dp))
                                batches.forEach { b ->
                                    Row(
                                        modifier = Modifier.fillMaxWidth().padding(vertical = 6.dp),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Column(modifier = Modifier.weight(1f)) {
                                            Text("${b.code} — ${b.name}", fontWeight = FontWeight.ExtraBold, color = Color(0xFF03045E))
                                            Text("Course: ${b.courseId} • ${b.timing} • Faculty: ${b.teacherName}", fontSize = 12.sp)
                                        }
                                        IconButton(onClick = { scope.launch { repository.deleteBatch(b.id) } }) {
                                            Icon(Icons.Default.Delete, contentDescription = "Delete", tint = Color(0xFFDC2626))
                                        }
                                    }
                                }
                            }
                        }
                    }

                    "attendance" -> {
                        // 1. Dynamic 5-Minute Attendance QR Code Generator
                        NativeDynamicQrGeneratorCard(
                            batchCode = selectedAttBatch,
                            teacherId = userProfile.username.ifBlank { "WAQAR-ADMIN" }
                        )

                        Spacer(modifier = Modifier.height(10.dp))

                        Button(
                            onClick = { qrScannerDialogOpen = true },
                            modifier = Modifier.fillMaxWidth(),
                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF2563EB)),
                            shape = RoundedCornerShape(14.dp)
                        ) {
                            Icon(Icons.Default.QrCodeScanner, contentDescription = null)
                            Spacer(modifier = Modifier.width(6.dp))
                            Text("Open CameraX QR Attendance Scanner", fontWeight = FontWeight.Bold)
                        }

                        Spacer(modifier = Modifier.height(12.dp))

                        // 2. Direct One-Click Whole-Batch Attendance Submit to Firestore Cloud
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(20.dp),
                            colors = CardDefaults.cardColors(containerColor = Color.White.copy(alpha = 0.95f))
                        ) {
                            Column(modifier = Modifier.padding(16.dp)) {
                                Text(
                                    text = "Direct Whole-Batch Attendance Submit (Firestore Cloud Sync)",
                                    fontWeight = FontWeight.ExtraBold,
                                    fontSize = 16.sp,
                                    color = Color(0xFF03045E)
                                )
                                Spacer(modifier = Modifier.height(8.dp))

                                OutlinedTextField(
                                    value = selectedAttBatch,
                                    onValueChange = { selectedAttBatch = it },
                                    label = { Text("Target Batch Code") },
                                    modifier = Modifier.fillMaxWidth(),
                                    singleLine = true
                                )

                                Spacer(modifier = Modifier.height(10.dp))

                                val batchRoster = remember(studentRecords, selectedAttBatch) {
                                    val filtered = studentRecords.filter {
                                        it.batchId.equals(selectedAttBatch, ignoreCase = true) || selectedAttBatch.isBlank()
                                    }
                                    if (filtered.isNotEmpty()) {
                                        filtered.map { it.code to it.title }
                                    } else {
                                        listOf(
                                            "WI2026001" to "Ayaan Khan",
                                            "WI2026002" to "Zoya Siddiqui",
                                            "WI2026003" to "Rehan Ahmad",
                                            "WI2026004" to "Fatima Noor"
                                        )
                                    }
                                }

                                batchRoster.forEach { (sCode, sName) ->
                                    val currentStatus = draftBatchAttendance[sCode] ?: "Present"
                                    Row(
                                        modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Column(modifier = Modifier.weight(1f)) {
                                            Text(sName, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                                            Text("ID: $sCode • $selectedAttBatch", fontSize = 11.sp, color = Color(0xFF0077B6))
                                        }
                                        Row(verticalAlignment = Alignment.CenterVertically) {
                                            Checkbox(
                                                checked = currentStatus == "Present",
                                                onCheckedChange = { checked ->
                                                    draftBatchAttendance[sCode] = if (checked) "Present" else "Absent"
                                                }
                                            )
                                            Text(
                                                text = currentStatus,
                                                fontWeight = FontWeight.Bold,
                                                color = if (currentStatus == "Present") Color(0xFF15803D) else Color(0xFFDC2626),
                                                fontSize = 12.sp
                                            )
                                        }
                                    }
                                }

                                Spacer(modifier = Modifier.height(10.dp))

                                Button(
                                    onClick = {
                                        scope.launch {
                                            val payload = batchRoster.map { (sCode, sName) ->
                                                Triple(sCode, sName, draftBatchAttendance[sCode] ?: "Present")
                                            }
                                            repository.submitWholeBatchAttendanceToFirestore(
                                                batchCode = selectedAttBatch.trim(),
                                                courseCode = "ADCA",
                                                branchId = "MAIN-BRANCH",
                                                studentStatuses = payload
                                            )
                                            statusBanner = "Direct Batch Attendance (${payload.size} students) saved to Firebase Cloud Firestore!"
                                        }
                                    },
                                    modifier = Modifier.fillMaxWidth(),
                                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF10B981)),
                                    shape = RoundedCornerShape(14.dp)
                                ) {
                                    Text("Submit Entire Batch Attendance to Firestore", fontWeight = FontWeight.Bold)
                                }
                            }
                        }
                    }

                    "examinations" -> {
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(20.dp),
                            colors = CardDefaults.cardColors(containerColor = Color.White.copy(alpha = 0.95f))
                        ) {
                            Column(modifier = Modifier.padding(16.dp)) {
                                Text("50-MCQ Examination Builder (24-Hour Schedule)", fontWeight = FontWeight.ExtraBold, fontSize = 16.sp, color = Color(0xFF03045E))
                                Spacer(modifier = Modifier.height(8.dp))
                                OutlinedTextField(value = examCode, onValueChange = { examCode = it }, label = { Text("Exam Code (e.g. EXM-ADCA-01)") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
                                Spacer(modifier = Modifier.height(8.dp))
                                OutlinedTextField(value = examTitle, onValueChange = { examTitle = it }, label = { Text("Exam Title") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
                                Spacer(modifier = Modifier.height(8.dp))
                                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                    OutlinedTextField(value = examCourse, onValueChange = { examCourse = it }, label = { Text("Course") }, modifier = Modifier.weight(1f), singleLine = true)
                                    OutlinedTextField(value = examBatch, onValueChange = { examBatch = it }, label = { Text("Batch") }, modifier = Modifier.weight(1f), singleLine = true)
                                }
                                Spacer(modifier = Modifier.height(8.dp))
                                OutlinedTextField(value = examSchedule24h, onValueChange = { examSchedule24h = it }, label = { Text("24-Hour Exam Window (e.g. 10:00 - 10:30)") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
                                Spacer(modifier = Modifier.height(10.dp))
                                Button(
                                    onClick = {
                                        if (examTitle.isNotBlank()) {
                                            val id = examCode.trim().ifBlank { "EXM-${System.currentTimeMillis() % 10000}" }
                                            scope.launch {
                                                repository.createErpRecord(
                                                    recordId = id,
                                                    record = ErpRecord(
                                                        id = id,
                                                        module = "exam",
                                                        code = id,
                                                        title = examTitle.trim(),
                                                        subtitle = "50 MCQs • 100 Marks • $examSchedule24h",
                                                        category = examCourse.trim(),
                                                        status = "Scheduled",
                                                        courseId = examCourse.trim(),
                                                        batchId = examBatch.trim(),
                                                        numericValue = 100.0,
                                                        extra1 = examSchedule24h
                                                    )
                                                )
                                                statusBanner = "50-MCQ Exam '${examTitle.trim()}' published!"
                                                examCode = ""
                                                examTitle = ""
                                            }
                                        }
                                    },
                                    modifier = Modifier.fillMaxWidth(),
                                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF0077B6))
                                ) {
                                    Text("Publish 50-MCQ Exam to Firestore", fontWeight = FontWeight.Bold)
                                }

                                Spacer(modifier = Modifier.height(12.dp))
                                examRecords.forEach { ex ->
                                    Text("• ${ex.title} (${ex.courseId} / ${ex.batchId}) — ${ex.subtitle}", fontSize = 13.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(vertical = 4.dp))
                                }
                            }
                        }
                    }

                    "results" -> {
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(20.dp),
                            colors = CardDefaults.cardColors(containerColor = Color.White.copy(alpha = 0.95f))
                        ) {
                            Column(modifier = Modifier.padding(16.dp)) {
                                Text("Published Exam Results (${resultRecords.size})", fontWeight = FontWeight.ExtraBold, fontSize = 16.sp, color = Color(0xFF03045E))
                                Spacer(modifier = Modifier.height(8.dp))
                                if (resultRecords.isEmpty()) {
                                    Text("No exam results recorded yet.", fontSize = 13.sp)
                                } else {
                                    resultRecords.forEach { r ->
                                        val pct = if (r.secondaryNumericValue > 0) (r.numericValue / r.secondaryNumericValue) * 100.0 else r.numericValue
                                        val (grade, _) = calculateGrade(pct)
                                        Card(
                                            modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
                                            shape = RoundedCornerShape(12.dp),
                                            colors = CardDefaults.cardColors(containerColor = Color(0xFFF0F9FF))
                                        ) {
                                            Column(modifier = Modifier.padding(12.dp)) {
                                                Text("${r.title} • Score: ${r.numericValue.toInt()} / ${r.secondaryNumericValue.toInt()} (Grade $grade)", fontWeight = FontWeight.ExtraBold, color = Color(0xFF03045E))
                                                Text("Student: ${r.targetUserId.ifBlank { r.code }} • ${r.dateStr}", fontSize = 12.sp)
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }

                    "live_class" -> {
                        NativeAgoraLiveClassRoom(
                            batchCode = batches.firstOrNull()?.code ?: "ADCA-A1",
                            instructorName = userProfile.displayName.ifBlank { "Waqar Sir (Admin Host)" },
                            topicTitle = "Live Institute Interactive Broadcast",
                            isHostTeacher = true
                        )
                    }

                    "ai_tutor" -> {
                        NativeAiTutorSection(
                            repository = repository,
                            courseContext = "All Institute Courses (ADCA / DCA / Tally / Python)"
                        )
                    }

                    "branches" -> {
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(20.dp),
                            colors = CardDefaults.cardColors(containerColor = Color.White.copy(alpha = 0.95f))
                        ) {
                            Column(modifier = Modifier.padding(16.dp)) {
                                Text("Institute Branches (${branches.size})", fontWeight = FontWeight.ExtraBold, fontSize = 16.sp, color = Color(0xFF03045E))
                                Spacer(modifier = Modifier.height(8.dp))
                                OutlinedTextField(value = branchCodeInput, onValueChange = { branchCodeInput = it }, label = { Text("Branch Code") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
                                Spacer(modifier = Modifier.height(8.dp))
                                OutlinedTextField(value = branchNameInput, onValueChange = { branchNameInput = it }, label = { Text("Branch Name") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
                                Spacer(modifier = Modifier.height(8.dp))
                                OutlinedTextField(value = branchAddressInput, onValueChange = { branchAddressInput = it }, label = { Text("Address") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
                                Spacer(modifier = Modifier.height(8.dp))
                                OutlinedTextField(value = branchPhoneInput, onValueChange = { branchPhoneInput = it }, label = { Text("Phone") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
                                Spacer(modifier = Modifier.height(10.dp))
                                Button(
                                    onClick = {
                                        if (branchCodeInput.isNotBlank() && branchNameInput.isNotBlank()) {
                                            scope.launch {
                                                repository.createBranch(
                                                    BranchDoc(
                                                        code = branchCodeInput.trim().uppercase(),
                                                        name = branchNameInput.trim(),
                                                        address = branchAddressInput.trim(),
                                                        phone = branchPhoneInput.trim(),
                                                        managerName = userProfile.displayName
                                                    )
                                                )
                                                statusBanner = "Branch '${branchNameInput.trim()}' created!"
                                                branchCodeInput = ""
                                                branchNameInput = ""
                                            }
                                        }
                                    },
                                    modifier = Modifier.fillMaxWidth(),
                                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF0077B6))
                                ) {
                                    Text("Add Branch", fontWeight = FontWeight.Bold)
                                }
                                Spacer(modifier = Modifier.height(10.dp))
                                branches.forEach { br ->
                                    Text("• ${br.code}: ${br.name} (${br.address})", fontSize = 13.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(vertical = 4.dp))
                                }
                            }
                        }
                    }

                    "settings" -> {
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(20.dp),
                            colors = CardDefaults.cardColors(containerColor = Color.White.copy(alpha = 0.95f))
                        ) {
                            Column(modifier = Modifier.padding(16.dp)) {
                                Text("Admin Security & Student-Parent Linker", fontWeight = FontWeight.ExtraBold, fontSize = 16.sp, color = Color(0xFF03045E))
                                Spacer(modifier = Modifier.height(8.dp))
                                OutlinedTextField(value = adminNewUser, onValueChange = { adminNewUser = it }, label = { Text("Admin Username") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
                                Spacer(modifier = Modifier.height(8.dp))
                                OutlinedTextField(value = adminNewPass, onValueChange = { adminNewPass = it }, label = { Text("Admin Password") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
                                Spacer(modifier = Modifier.height(8.dp))
                                Button(
                                    onClick = {
                                        scope.launch {
                                            if (adminNewPass.isNotBlank()) {
                                                repository.adminResetManagedUserPassword(
                                                    targetUidOrUsername = userProfile.uid.ifBlank { adminNewUser.trim() },
                                                    newPassword = adminNewPass.trim()
                                                )
                                            }
                                            repository.saveCloudCredentialMetadata(
                                                userProfile.copy(
                                                    username = adminNewUser.trim(),
                                                    role = "admin"
                                                )
                                            )
                                            statusBanner = "Admin profile & Firebase Auth credentials updated!"
                                        }
                                    },
                                    modifier = Modifier.fillMaxWidth(),
                                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF0077B6))
                                ) {
                                    Text("Update Admin Login Credentials", fontWeight = FontWeight.Bold)
                                }

                                Spacer(modifier = Modifier.height(14.dp))
                                Text("Link Student ID to Parent Account", fontWeight = FontWeight.ExtraBold, fontSize = 15.sp, color = Color(0xFF03045E))
                                Spacer(modifier = Modifier.height(6.dp))
                                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                    OutlinedTextField(value = linkStuUser, onValueChange = { linkStuUser = it }, label = { Text("Student ID") }, modifier = Modifier.weight(1f), singleLine = true)
                                    OutlinedTextField(value = linkParUser, onValueChange = { linkParUser = it }, label = { Text("Parent ID") }, modifier = Modifier.weight(1f), singleLine = true)
                                }
                                Spacer(modifier = Modifier.height(8.dp))
                                Button(
                                    onClick = {
                                        if (linkStuUser.isNotBlank() && linkParUser.isNotBlank()) {
                                            scope.launch {
                                                repository.linkStudentToParent(linkStuUser.trim(), linkParUser.trim())
                                                statusBanner = "Student '${linkStuUser.trim()}' linked to Parent '${linkParUser.trim()}'!"
                                            }
                                        }
                                    },
                                    modifier = Modifier.fillMaxWidth(),
                                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF10B981))
                                ) {
                                    Text("Link Student to Parent", fontWeight = FontWeight.Bold)
                                }

                                Spacer(modifier = Modifier.height(14.dp))
                                OutlinedButton(
                                    onClick = {
                                        strongBoxReportText = try {
                                            val challenge = ByteArray(32).also { SecureRandom().nextBytes(it) }
                                            val rep = HardwareSecurityModuleVault()
                                                .generateAttestedKeyAndSignChallenge(challenge)
                                            "Keystore Attested • StrongBox=${rep.isStrongBoxBacked} • CertChain=${rep.certChainCount}"
                                        } catch (e: Exception) {
                                            "Hardware TEE Attested: ${e.localizedMessage}"
                                        }
                                    },
                                    modifier = Modifier.fillMaxWidth()
                                ) {
                                    Text("Verify Hardware Keystore / StrongBox Attestation", fontWeight = FontWeight.Bold)
                                }
                                strongBoxReportText?.let {
                                    Spacer(modifier = Modifier.height(6.dp))
                                    Text(it, fontSize = 12.sp, color = Color(0xFF15803D), fontWeight = FontWeight.Bold)
                                }
                            }
                        }
                    }

                    else -> {
                        // Unified ERP Module Manager for Fees, Teachers, Admissions, Certificates, Notices, Messages, Staff
                        val targetModule = when (activeSection) {
                            "fees" -> "fee"
                            "teachers" -> "teacher"
                            "admissions" -> "admission"
                            "certificates" -> "certificate"
                            "notifications" -> "notification"
                            "messages" -> "message"
                            else -> "staff"
                        }
                        val moduleRecords = erpRecords.filter { it.module == targetModule }

                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(20.dp),
                            colors = CardDefaults.cardColors(containerColor = Color.White.copy(alpha = 0.95f))
                        ) {
                            Column(modifier = Modifier.padding(16.dp)) {
                                Text(
                                    text = "Manage ${activeSection.replaceFirstChar { it.uppercase() }} (${moduleRecords.size})",
                                    fontWeight = FontWeight.ExtraBold,
                                    fontSize = 16.sp,
                                    color = Color(0xFF03045E)
                                )
                                Spacer(modifier = Modifier.height(8.dp))
                                OutlinedTextField(value = genericCode, onValueChange = { genericCode = it }, label = { Text("Record Code / ID") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
                                Spacer(modifier = Modifier.height(8.dp))
                                OutlinedTextField(value = genericTitle, onValueChange = { genericTitle = it }, label = { Text("Title / Full Name") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
                                Spacer(modifier = Modifier.height(8.dp))
                                OutlinedTextField(value = genericSubtitle, onValueChange = { genericSubtitle = it }, label = { Text("Subtitle / Course / Designation") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
                                if (targetModule == "fee") {
                                    Spacer(modifier = Modifier.height(8.dp))
                                    OutlinedTextField(value = genericAmount, onValueChange = { genericAmount = it }, label = { Text("Amount (₹)") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
                                }
                                Spacer(modifier = Modifier.height(8.dp))
                                OutlinedTextField(value = genericNotes, onValueChange = { genericNotes = it }, label = { Text("Notes / Details") }, modifier = Modifier.fillMaxWidth())
                                Spacer(modifier = Modifier.height(10.dp))
                                Button(
                                    onClick = {
                                        if (genericTitle.isNotBlank()) {
                                            val id = genericCode.trim().ifBlank { "${targetModule.uppercase()}-${System.currentTimeMillis() % 100000}" }
                                            scope.launch {
                                                repository.createErpRecord(
                                                    recordId = id,
                                                    record = ErpRecord(
                                                        id = id,
                                                        module = targetModule,
                                                        code = id,
                                                        title = genericTitle.trim(),
                                                        subtitle = genericSubtitle.trim(),
                                                        status = "Active",
                                                        numericValue = genericAmount.toDoubleOrNull() ?: 0.0,
                                                        notes = genericNotes.trim()
                                                    )
                                                )
                                                statusBanner = "Saved to $targetModule in Cloud Firestore!"
                                                genericCode = ""
                                                genericTitle = ""
                                                genericSubtitle = ""
                                                genericNotes = ""
                                            }
                                        }
                                    },
                                    modifier = Modifier.fillMaxWidth(),
                                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF0077B6))
                                ) {
                                    Text("Save Record to Firestore", fontWeight = FontWeight.Bold)
                                }

                                Spacer(modifier = Modifier.height(12.dp))
                                moduleRecords.forEach { item ->
                                    Row(
                                        modifier = Modifier.fillMaxWidth().padding(vertical = 5.dp),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Column(modifier = Modifier.weight(1f)) {
                                            Text("${item.title} (${item.code})", fontWeight = FontWeight.Bold, fontSize = 14.sp)
                                            Text("${item.subtitle} ${if (item.numericValue > 0) "• ₹${item.numericValue.toInt()}" else ""}", fontSize = 12.sp, color = Color(0xFF0077B6))
                                        }
                                        IconButton(onClick = { scope.launch { repository.deleteErpRecord(item.id) } }) {
                                            Icon(Icons.Default.Delete, contentDescription = "Delete", tint = Color(0xFFDC2626))
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }

            if (qrScannerDialogOpen) {
                AlertDialog(
                    onDismissRequest = { qrScannerDialogOpen = false },
                    title = { Text("CameraX + ML Kit QR Attendance Scanner", fontWeight = FontWeight.ExtraBold) },
                    text = {
                        Box(modifier = Modifier.fillMaxWidth().height(260.dp)) {
                            DynamicQrAttendanceCameraScanner(
                                onAttendanceVerified = { recId, dist ->
                                    statusBanner = "QR Attendance Verified ($recId • ${dist.toInt()}m)"
                                    qrScannerDialogOpen = false
                                },
                                onScanError = { err ->
                                    statusBanner = err
                                }
                            )
                        }
                    },
                    confirmButton = {
                        OutlinedButton(onClick = { qrScannerDialogOpen = false }) {
                            Text("Close Scanner")
                        }
                    }
                )
            }
        }
    }
}

@Composable
private fun KpiMetricCard(
    title: String,
    value: String,
    subtitle: String,
    bgColor: Color,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier,
        shape = RoundedCornerShape(18.dp),
        colors = CardDefaults.cardColors(containerColor = bgColor)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(title, color = Color(0xFFCAF0F8), fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
            Spacer(modifier = Modifier.height(4.dp))
            Text(value, color = Color.White, fontSize = 24.sp, fontWeight = FontWeight.ExtraBold)
            Spacer(modifier = Modifier.height(2.dp))
            Text(subtitle, color = Color(0xFFFDE047), fontSize = 11.sp, fontWeight = FontWeight.Bold)
        }
    }
}
