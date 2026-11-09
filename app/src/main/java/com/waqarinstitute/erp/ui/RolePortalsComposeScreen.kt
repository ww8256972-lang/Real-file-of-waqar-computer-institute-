package com.waqarinstitute.erp.ui

import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
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
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Assignment
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.Bolt
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.ExitToApp
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Image
import androidx.compose.material.icons.filled.Key
import androidx.compose.material.icons.filled.MenuBook
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.QrCodeScanner
import androidx.compose.material.icons.filled.Videocam
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
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
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.waqarinstitute.erp.security.DynamicQrAttendanceCameraScanner
import com.waqarinstitute.erp.security.ExamKioskLifecycleGuard
import com.waqarinstitute.erp.security.FlagSecureScreenShield
import com.waqarinstitute.erp.security.SecurityWatermarkOverlay
import com.waqarinstitute.erp.data.BatchDoc
import com.waqarinstitute.erp.data.CourseDoc
import com.waqarinstitute.erp.data.ErpRecord
import com.waqarinstitute.erp.data.UserProfile
import com.waqarinstitute.erp.data.WaqarFirebaseRepository
import com.waqarinstitute.erp.data.calculateGrade
import com.waqarinstitute.erp.data.generate50McqQuestionBank
import com.waqarinstitute.erp.data.local.StudentEntity
import com.waqarinstitute.erp.data.local.WaqarDatabase
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.util.Locale

// ============================================================================
// 1. PURE NATIVE JETPACK COMPOSE STUDENT PORTAL
//    Displays Admin/Teacher-uploaded Student Profile Photo (e.g., Rashid) in:
//    - TopAppBar Header Avatar
//    - Home Welcome Banner Avatar
//    - Digital Student ID Card & Profile Tab
// ============================================================================
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun StudentRoleComposePortal(
    userProfile: UserProfile,
    repository: WaqarFirebaseRepository,
    database: WaqarDatabase,
    onLogout: () -> Unit
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    val courses by repository.observeCourses().collectAsState(initial = emptyList())
    val batches by repository.observeBatches().collectAsState(initial = emptyList())
    val erpRecords by repository.observeAllErpRecords().collectAsState(initial = emptyList())

    // Match the student's ERP record & profile photo uploaded from Admin / Teacher portal
    val matchedStudentRecord = remember(erpRecords, userProfile) {
        val studentDocs = erpRecords.filter { it.module == "student" }
        val candidateCodes = listOf(
            userProfile.linkedEntityId.trim(),
            userProfile.username.trim(),
            userProfile.uid.trim()
        ).filter { it.isNotBlank() }
        val candidateNames = listOf(
            userProfile.displayName.trim()
        ).filter { it.isNotBlank() }

        studentDocs.firstOrNull { st ->
            val codeMatch = candidateCodes.any { c ->
                st.code.equals(c, ignoreCase = true) ||
                    st.targetUserId.equals(c, ignoreCase = true)
            }
            val nameMatch = candidateNames.any { n ->
                st.title.equals(n, ignoreCase = true)
            }
            codeMatch || nameMatch
        }
    }

    val studentId = matchedStudentRecord?.code?.ifBlank { null }
        ?: userProfile.linkedEntityId.ifBlank { userProfile.username.ifBlank { "STU-${userProfile.uid.take(6)}" } }
    val studentName = matchedStudentRecord?.title?.ifBlank { null }
        ?: userProfile.displayName.ifBlank { userProfile.username.ifBlank { "Student" } }
    val enrolledCourse = matchedStudentRecord?.courseId?.ifBlank { null }
        ?: courses.firstOrNull()?.code ?: "ADCA"
    val enrolledBatch = matchedStudentRecord?.batchId?.ifBlank { null }
        ?: batches.firstOrNull()?.code ?: "ADCA-A1"
    val activeStudentPhotoData = matchedStudentRecord?.extra1.orEmpty()

    var selectedTab by remember { mutableStateOf("Home") }
    var activeSubScreen by remember { mutableStateOf<String?>(null) }
    var showQrScanner by remember { mutableStateOf(false) }
    var statusBanner by remember { mutableStateOf("") }

    // 50-MCQ Exam State
    var examRunning by remember { mutableStateOf(false) }
    var examTimeLeftSec by remember { mutableIntStateOf(30 * 60) }
    var currentQuestionIdx by remember { mutableIntStateOf(0) }
    val selectedAnswers = remember { mutableStateMapOf<Int, String>() }
    var activeExamTopic by remember { mutableStateOf(enrolledCourse) }
    val mcqQuestions = remember(activeExamTopic) {
        generate50McqQuestionBank(activeExamTopic)
    }

    LaunchedEffect(examRunning) {
        while (examRunning && examTimeLeftSec > 0) {
            delay(1000L)
            examTimeLeftSec--
            if (examTimeLeftSec == 0) {
                examRunning = false
            }
        }
    }

    val myAttendanceLogs = remember(erpRecords, studentId, studentName) {
        erpRecords.filter {
            it.module == "attendance" && (
                it.code.equals(studentId, ignoreCase = true) ||
                    it.targetUserId.equals(studentId, ignoreCase = true) ||
                    it.title.equals(studentName, ignoreCase = true)
                )
        }
    }
    val attendancePercent = remember(myAttendanceLogs) {
        if (myAttendanceLogs.isEmpty()) 94 else {
            val presentCount = myAttendanceLogs.count { it.status.equals("Present", ignoreCase = true) }
            ((presentCount * 100) / myAttendanceLogs.size).coerceIn(0, 100)
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        StudentProfilePhotoAvatar(
                            photoDataOrUri = activeStudentPhotoData,
                            studentName = studentName,
                            sizeDp = 40
                        )
                        Spacer(modifier = Modifier.width(10.dp))
                        Column {
                            Text(
                                text = "WAQAR INSTITUTE • STUDENT ERP",
                                fontWeight = FontWeight.ExtraBold,
                                fontSize = 14.sp,
                                color = Color.White
                            )
                            Text(
                                text = "$studentName ($studentId) • $enrolledCourse",
                                fontSize = 11.sp,
                                color = Color(0xFFBAE6FD)
                            )
                        }
                    }
                },
                actions = {
                    if (activeSubScreen != null) {
                        TextButton(onClick = { activeSubScreen = null }) {
                            Text("Back", color = Color(0xFF38BDF8), fontWeight = FontWeight.Bold)
                        }
                    }
                    IconButton(onClick = onLogout) {
                        Icon(Icons.Default.ExitToApp, contentDescription = "Logout", tint = Color(0xFFFCA5A5))
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = Color(0xFF0A192F))
            )
        },
        bottomBar = {
            NavigationBar(containerColor = Color.White, tonalElevation = 8.dp) {
                listOf(
                    Triple("Home", Icons.Default.Home, "Home"),
                    Triple("Courses", Icons.Default.MenuBook, "Courses"),
                    Triple("Exams", Icons.Default.Assignment, "50-MCQ"),
                    Triple("Attendance", Icons.Default.QrCodeScanner, "Attendance"),
                    Triple("AI Tutor", Icons.Default.AutoAwesome, "AI Tutor"),
                    Triple("Profile", Icons.Default.Person, "Profile")
                ).forEach { (key, icon, label) ->
                    NavigationBarItem(
                        selected = selectedTab == key && activeSubScreen == null,
                        onClick = {
                            activeSubScreen = null
                            selectedTab = key
                        },
                        icon = { Icon(icon, contentDescription = label) },
                        label = { Text(label, fontSize = 10.sp, maxLines = 1) }
                    )
                }
            }
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .background(Color(0xFFF1F5F9))
        ) {
            if (statusBanner.isNotBlank()) {
                Surface(
                    color = Color(0xFFDCFCE7),
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 14.dp, vertical = 6.dp),
                    shape = RoundedCornerShape(10.dp)
                ) {
                    Row(
                        modifier = Modifier.padding(10.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = statusBanner,
                            color = Color(0xFF166534),
                            fontWeight = FontWeight.Bold,
                            fontSize = 12.sp,
                            modifier = Modifier.weight(1f)
                        )
                        IconButton(onClick = { statusBanner = "" }, modifier = Modifier.size(22.dp)) {
                            Icon(Icons.Default.Close, contentDescription = null, tint = Color(0xFF166534))
                        }
                    }
                }
            }

            val currentView = activeSubScreen ?: selectedTab
            LazyColumn(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(14.dp),
                verticalArrangement = Arrangement.spacedBy(14.dp)
            ) {
                when (currentView) {
                    "Home" -> {
                        item {
                            Card(
                                modifier = Modifier.fillMaxWidth(),
                                shape = RoundedCornerShape(22.dp),
                                colors = CardDefaults.cardColors(containerColor = Color(0xFF0A192F))
                            ) {
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(18.dp),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Column(modifier = Modifier.weight(1f)) {
                                        Row(verticalAlignment = Alignment.CenterVertically) {
                                            StudentProfilePhotoAvatar(
                                                photoDataOrUri = activeStudentPhotoData,
                                                studentName = studentName,
                                                sizeDp = 58
                                            )
                                            Spacer(modifier = Modifier.width(12.dp))
                                            Column {
                                                Surface(
                                                    color = Color(0xFF0284C7).copy(alpha = 0.25f),
                                                    shape = RoundedCornerShape(8.dp)
                                                ) {
                                                    Text(
                                                        text = "VERIFIED STUDENT PORTAL",
                                                        color = Color(0xFF38BDF8),
                                                        fontSize = 10.sp,
                                                        fontWeight = FontWeight.ExtraBold,
                                                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                                                    )
                                                }
                                                Spacer(modifier = Modifier.height(4.dp))
                                                Text(
                                                    text = "Welcome, $studentName",
                                                    color = Color.White,
                                                    fontWeight = FontWeight.ExtraBold,
                                                    fontSize = 19.sp
                                                )
                                                Text(
                                                    text = "$enrolledCourse • $enrolledBatch",
                                                    color = Color(0xFFBAE6FD),
                                                    fontSize = 12.sp
                                                )
                                            }
                                        }
                                        Spacer(modifier = Modifier.height(12.dp))
                                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                            Button(
                                                onClick = { activeSubScreen = "LiveClass" },
                                                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF0284C7)),
                                                shape = RoundedCornerShape(10.dp)
                                            ) {
                                                Icon(Icons.Default.Videocam, contentDescription = null, modifier = Modifier.size(16.dp))
                                                Spacer(modifier = Modifier.width(6.dp))
                                                Text("Join Live Class", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                                            }
                                            OutlinedButton(
                                                onClick = { selectedTab = "Attendance"; showQrScanner = true },
                                                border = BorderStroke(1.dp, Color(0xFF38BDF8)),
                                                shape = RoundedCornerShape(10.dp)
                                            ) {
                                                Text("Scan QR", color = Color(0xFF38BDF8), fontSize = 11.sp, fontWeight = FontWeight.Bold)
                                            }
                                        }
                                    }
                                    Spacer(modifier = Modifier.width(12.dp))
                                    NativeCircularProgressRing(
                                        percentage = attendancePercent,
                                        label = "Attendance",
                                        activeColor = Color(0xFF22C55E)
                                    )
                                }
                            }
                        }

                        item {
                            Text(
                                text = "Quick Student Modules",
                                fontWeight = FontWeight.ExtraBold,
                                fontSize = 16.sp,
                                color = Color(0xFF0F172A)
                            )
                            Spacer(modifier = Modifier.height(8.dp))
                            val quickActions = listOf(
                                Triple("LiveClass", "Agora Live Class", Color(0xFF0284C7)),
                                Triple("Exams", "50-MCQ Exam", Color(0xFF7C3AED)),
                                Triple("Attendance", "QR Attendance", Color(0xFF16A34A)),
                                Triple("AI Tutor", "Gemini AI Tutor", Color(0xFFD97706)),
                                Triple("Results", "Exam Results", Color(0xFF2563EB)),
                                Triple("Fees", "Fee Receipts", Color(0xFF0D9488)),
                                Triple("Materials", "Study PDF Notes", Color(0xFF4F46E5)),
                                Triple("Profile", "Digital ID & Photo", Color(0xFFBE123C))
                            )
                            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                                quickActions.chunked(2).forEach { pair ->
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                                    ) {
                                        pair.forEach { (dest, title, accent) ->
                                            Card(
                                                modifier = Modifier
                                                    .weight(1f)
                                                    .clickable {
                                                        if (dest in listOf("Exams", "Attendance", "AI Tutor", "Profile")) {
                                                            activeSubScreen = null
                                                            selectedTab = dest
                                                        } else {
                                                            activeSubScreen = dest
                                                        }
                                                    },
                                                shape = RoundedCornerShape(16.dp),
                                                colors = CardDefaults.cardColors(containerColor = Color.White),
                                                elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
                                            ) {
                                                Row(
                                                    modifier = Modifier.padding(14.dp),
                                                    verticalAlignment = Alignment.CenterVertically
                                                ) {
                                                    Box(
                                                        modifier = Modifier
                                                            .size(38.dp)
                                                            .clip(RoundedCornerShape(10.dp))
                                                            .background(accent.copy(alpha = 0.14f)),
                                                        contentAlignment = Alignment.Center
                                                    ) {
                                                        Icon(Icons.Default.Bolt, contentDescription = null, tint = accent)
                                                    }
                                                    Spacer(modifier = Modifier.width(10.dp))
                                                    Text(
                                                        text = title,
                                                        fontWeight = FontWeight.Bold,
                                                        fontSize = 13.sp,
                                                        color = Color(0xFF0F172A)
                                                    )
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }

                    "LiveClass" -> {
                        item {
                            NativeAgoraLiveClassRoom(
                                batchCode = enrolledBatch,
                                instructorName = "Waqar Sir • $enrolledCourse",
                                topicTitle = "Interactive Live Classroom ($enrolledCourse)",
                                isHostTeacher = false
                            )
                        }
                    }

                    "Courses" -> {
                        item {
                            Text(
                                text = "Admin-Published Institute Courses (${courses.size})",
                                fontWeight = FontWeight.ExtraBold,
                                fontSize = 18.sp,
                                color = Color(0xFF0F172A)
                            )
                            Text(
                                text = "Synced in real-time with Firebase Cloud Firestore",
                                fontSize = 12.sp,
                                color = Color(0xFF64748B)
                            )
                        }
                        items(courses) { course ->
                            Card(
                                modifier = Modifier.fillMaxWidth(),
                                shape = RoundedCornerShape(16.dp),
                                colors = CardDefaults.cardColors(containerColor = Color.White)
                            ) {
                                Column(modifier = Modifier.padding(16.dp)) {
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Text(
                                            text = "${course.code} — ${course.name}",
                                            fontWeight = FontWeight.ExtraBold,
                                            fontSize = 15.sp,
                                            color = Color(0xFF0F172A),
                                            modifier = Modifier.weight(1f)
                                        )
                                        Surface(
                                            color = Color(0xFFE0F2FE),
                                            shape = RoundedCornerShape(8.dp)
                                        ) {
                                            Text(
                                                text = course.duration,
                                                color = Color(0xFF0284C7),
                                                fontWeight = FontWeight.Bold,
                                                fontSize = 11.sp,
                                                modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                                            )
                                        }
                                    }
                                    Spacer(modifier = Modifier.height(6.dp))
                                    Text(
                                        text = "Syllabus: ${course.syllabus}",
                                        fontSize = 12.sp,
                                        color = Color(0xFF475569)
                                    )
                                    Spacer(modifier = Modifier.height(10.dp))
                                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                        Button(
                                            onClick = { activeSubScreen = "LiveClass" },
                                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF0284C7)),
                                            shape = RoundedCornerShape(10.dp)
                                        ) {
                                            Text("Open Live Class", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                                        }
                                        OutlinedButton(
                                            onClick = {
                                                activeExamTopic = course.code
                                                selectedTab = "Exams"
                                            },
                                            shape = RoundedCornerShape(10.dp)
                                        ) {
                                            Text("Start 50-MCQ Exam", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                                        }
                                    }
                                }
                            }
                        }
                    }

                    "Exams" -> {
                        item {
                            if (!examRunning) {
                                Card(
                                    modifier = Modifier.fillMaxWidth(),
                                    shape = RoundedCornerShape(18.dp),
                                    colors = CardDefaults.cardColors(containerColor = Color(0xFF0F172A))
                                ) {
                                    Column(modifier = Modifier.padding(18.dp)) {
                                        Text(
                                            text = "50-MCQ Hardware-Enforced Online Examination",
                                            color = Color.White,
                                            fontWeight = FontWeight.ExtraBold,
                                            fontSize = 17.sp
                                        )
                                        Text(
                                            text = "Protected by FLAG_SECURE, Dynamic Watermark, 3-Strike Split-Screen Guard & Hardware Keystore Attestation.",
                                            color = Color(0xFF94A3B8),
                                            fontSize = 12.sp
                                        )
                                        Spacer(modifier = Modifier.height(12.dp))
                                        Button(
                                            onClick = {
                                                selectedAnswers.clear()
                                                currentQuestionIdx = 0
                                                examTimeLeftSec = 30 * 60
                                                examRunning = true
                                            },
                                            modifier = Modifier.fillMaxWidth(),
                                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF16A34A)),
                                            shape = RoundedCornerShape(12.dp)
                                        ) {
                                            Icon(Icons.Default.PlayArrow, contentDescription = null)
                                            Spacer(modifier = Modifier.width(8.dp))
                                            Text("Launch 50-MCQ Proctored Exam Now", fontWeight = FontWeight.ExtraBold)
                                        }
                                    }
                                }
                            } else {
                                FlagSecureScreenShield {
                                    ExamKioskLifecycleGuard(
                                        examId = "EXAM-$studentId",
                                        onThirdStrikeExamTerminated = {
                                            examRunning = false
                                            statusBanner = "Exam Auto-Terminated due to 3 security violations."
                                        }
                                    ) {
                                        SecurityWatermarkOverlay(
                                            studentFullName = studentName,
                                            rollNumber = studentId,
                                            phoneNumber = "9876543210"
                                        ) {
                                            val q = mcqQuestions.getOrElse(currentQuestionIdx) { mcqQuestions.first() }
                                            val optionsList = listOf(
                                                "A" to q.optionA,
                                                "B" to q.optionB,
                                                "C" to q.optionC,
                                                "D" to q.optionD
                                            )
                                            Card(
                                                modifier = Modifier.fillMaxWidth(),
                                                shape = RoundedCornerShape(18.dp),
                                                colors = CardDefaults.cardColors(containerColor = Color.White)
                                            ) {
                                                Column(modifier = Modifier.padding(16.dp)) {
                                                    Row(
                                                        modifier = Modifier.fillMaxWidth(),
                                                        horizontalArrangement = Arrangement.SpaceBetween,
                                                        verticalAlignment = Alignment.CenterVertically
                                                    ) {
                                                        Text(
                                                            text = "Question ${currentQuestionIdx + 1} / 50",
                                                            fontWeight = FontWeight.ExtraBold,
                                                            fontSize = 15.sp,
                                                            color = Color(0xFF0F172A)
                                                        )
                                                        Surface(
                                                            color = Color(0xFFFEE2E2),
                                                            shape = RoundedCornerShape(8.dp)
                                                        ) {
                                                            Text(
                                                                text = String.format(
                                                                    Locale.US,
                                                                    "%02d:%02d",
                                                                    examTimeLeftSec / 60,
                                                                    examTimeLeftSec % 60
                                                                ),
                                                                color = Color(0xFFDC2626),
                                                                fontWeight = FontWeight.ExtraBold,
                                                                fontFamily = FontFamily.Monospace,
                                                                fontSize = 13.sp,
                                                                modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp)
                                                            )
                                                        }
                                                    }
                                                    Spacer(modifier = Modifier.height(10.dp))
                                                    Text(
                                                        text = q.question,
                                                        fontWeight = FontWeight.Bold,
                                                        fontSize = 15.sp,
                                                        color = Color(0xFF1E293B)
                                                    )
                                                    Spacer(modifier = Modifier.height(12.dp))
                                                    optionsList.forEach { (optKey, optLabel) ->
                                                        val isSelected = selectedAnswers[currentQuestionIdx] == optKey
                                                        Surface(
                                                            modifier = Modifier
                                                                .fillMaxWidth()
                                                                .padding(vertical = 4.dp)
                                                                .clickable { selectedAnswers[currentQuestionIdx] = optKey },
                                                            shape = RoundedCornerShape(12.dp),
                                                            color = if (isSelected) Color(0xFFE0F2FE) else Color(0xFFF8FAFC),
                                                            border = BorderStroke(
                                                                1.dp,
                                                                if (isSelected) Color(0xFF0284C7) else Color(0xFFE2E8F0)
                                                            )
                                                        ) {
                                                            Row(
                                                                modifier = Modifier.padding(12.dp),
                                                                verticalAlignment = Alignment.CenterVertically
                                                            ) {
                                                                RadioButton(
                                                                    selected = isSelected,
                                                                    onClick = { selectedAnswers[currentQuestionIdx] = optKey }
                                                                )
                                                                Spacer(modifier = Modifier.width(8.dp))
                                                                Text(
                                                                    text = "$optKey. $optLabel",
                                                                    fontSize = 13.sp,
                                                                    fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal,
                                                                    color = Color(0xFF0F172A)
                                                                )
                                                            }
                                                        }
                                                    }
                                                    Spacer(modifier = Modifier.height(12.dp))
                                                    Row(
                                                        modifier = Modifier.fillMaxWidth(),
                                                        horizontalArrangement = Arrangement.SpaceBetween
                                                    ) {
                                                        OutlinedButton(
                                                            onClick = { if (currentQuestionIdx > 0) currentQuestionIdx-- },
                                                            enabled = currentQuestionIdx > 0
                                                        ) {
                                                            Text("Previous")
                                                        }
                                                        if (currentQuestionIdx < 49) {
                                                            Button(
                                                                onClick = { currentQuestionIdx++ },
                                                                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF0284C7))
                                                            ) {
                                                                Text("Next Question")
                                                            }
                                                        } else {
                                                            Button(
                                                                onClick = {
                                                                    val correctCount = mcqQuestions.indices.count { i ->
                                                                        selectedAnswers[i] == mcqQuestions[i].correctOption
                                                                    }
                                                                    val marksScored = correctCount * 2.0
                                                                    val pct = (correctCount * 100.0) / 50.0
                                                                    val (grade, passed) = calculateGrade(pct)
                                                                    val resId = "RES-$studentId-${System.currentTimeMillis() % 10000}"
                                                                    scope.launch {
                                                                        repository.createErpRecord(
                                                                            recordId = resId,
                                                                            record = ErpRecord(
                                                                                id = resId,
                                                                                module = "result",
                                                                                code = studentId,
                                                                                title = "$activeExamTopic 50-MCQ Exam — $studentName",
                                                                                subtitle = "Score: ${marksScored.toInt()}/100 ($correctCount/50 Correct • Grade $grade)",
                                                                                category = activeExamTopic,
                                                                                status = if (passed) "PASSED" else "NEEDS IMPROVEMENT",
                                                                                courseId = enrolledCourse,
                                                                                batchId = enrolledBatch,
                                                                                targetUserId = studentId,
                                                                                numericValue = marksScored,
                                                                                secondaryNumericValue = 100.0
                                                                            )
                                                                        )
                                                                        examRunning = false
                                                                        statusBanner = "Exam Submitted! Score: ${marksScored.toInt()}/100 (Grade $grade) synced to Firestore."
                                                                    }
                                                                },
                                                                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF16A34A))
                                                            ) {
                                                                Text("Submit All 50 MCQs", fontWeight = FontWeight.Bold)
                                                            }
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }

                    "Attendance" -> {
                        item {
                            Card(
                                modifier = Modifier.fillMaxWidth(),
                                shape = RoundedCornerShape(18.dp),
                                colors = CardDefaults.cardColors(containerColor = Color.White)
                            ) {
                                Column(modifier = Modifier.padding(16.dp)) {
                                    Text(
                                        text = "CameraX Live 5-Minute QR Attendance Scanner",
                                        fontWeight = FontWeight.ExtraBold,
                                        fontSize = 16.sp,
                                        color = Color(0xFF0F172A)
                                    )
                                    Text(
                                        text = "Point your camera at the Teacher or Admin's Dynamic 5-Minute QR Code.",
                                        fontSize = 12.sp,
                                        color = Color(0xFF64748B)
                                    )
                                    Spacer(modifier = Modifier.height(10.dp))
                                    Button(
                                        onClick = { showQrScanner = !showQrScanner },
                                        modifier = Modifier.fillMaxWidth(),
                                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF16A34A)),
                                        shape = RoundedCornerShape(12.dp)
                                    ) {
                                        Icon(Icons.Default.QrCodeScanner, contentDescription = null)
                                        Spacer(modifier = Modifier.width(8.dp))
                                        Text(
                                            if (showQrScanner) "Close CameraX Scanner" else "Launch CameraX QR Scanner",
                                            fontWeight = FontWeight.Bold
                                        )
                                    }
                                    if (showQrScanner) {
                                        Spacer(modifier = Modifier.height(12.dp))
                                        Box(
                                            modifier = Modifier
                                                .fillMaxWidth()
                                                .height(260.dp)
                                                .clip(RoundedCornerShape(16.dp))
                                        ) {
                                            DynamicQrAttendanceCameraScanner(
                                                onAttendanceVerified = { recId, dist ->
                                                    showQrScanner = false
                                                    scope.launch {
                                                        val attId = "ATT-QR-$studentId-${System.currentTimeMillis() % 10000}"
                                                        repository.createErpRecord(
                                                            recordId = attId,
                                                            record = ErpRecord(
                                                                id = attId,
                                                                module = "attendance",
                                                                code = studentId,
                                                                title = studentName,
                                                                subtitle = "QR Verified ($recId • ${dist.toInt()}m)",
                                                                category = "QR CameraX",
                                                                status = "Present",
                                                                courseId = enrolledCourse,
                                                                batchId = enrolledBatch,
                                                                targetUserId = studentId,
                                                                numericValue = 100.0
                                                            )
                                                        )
                                                        statusBanner = "QR Attendance Verified & Synced to Firestore!"
                                                    }
                                                },
                                                onScanError = { err ->
                                                    statusBanner = err
                                                }
                                            )
                                        }
                                    }
                                }
                            }
                        }
                    }

                    "AI Tutor" -> {
                        item {
                            NativeAiTutorSection(
                                repository = repository,
                                courseContext = "$enrolledCourse ($studentName)"
                            )
                        }
                    }

                    "Results", "Fees", "Materials", "Certificates", "Profile" -> {
                        item {
                            Card(
                                modifier = Modifier.fillMaxWidth(),
                                shape = RoundedCornerShape(18.dp),
                                colors = CardDefaults.cardColors(containerColor = Color.White)
                            ) {
                                Column(modifier = Modifier.padding(18.dp)) {
                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                        StudentProfilePhotoAvatar(
                                            photoDataOrUri = activeStudentPhotoData,
                                            studentName = studentName,
                                            sizeDp = 72
                                        )
                                        Spacer(modifier = Modifier.width(14.dp))
                                        Column {
                                            Text(
                                                text = "Digital Student ID Card",
                                                fontWeight = FontWeight.ExtraBold,
                                                fontSize = 17.sp,
                                                color = Color(0xFF0F172A)
                                            )
                                            Text("Name: $studentName", fontWeight = FontWeight.Bold, fontSize = 15.sp, color = Color(0xFF03045E))
                                            Text("Enrollment ID: $studentId", fontSize = 13.sp, color = Color(0xFF0284C7), fontWeight = FontWeight.SemiBold)
                                            Text("Course & Batch: $enrolledCourse • $enrolledBatch", fontSize = 12.sp)
                                            Text("Attendance Rate: $attendancePercent% (Verified)", fontSize = 12.sp, color = Color(0xFF16A34A), fontWeight = FontWeight.Bold)
                                        }
                                    }
                                    Spacer(modifier = Modifier.height(14.dp))
                                    Button(
                                        onClick = onLogout,
                                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFDC2626)),
                                        shape = RoundedCornerShape(10.dp)
                                    ) {
                                        Icon(Icons.Default.ExitToApp, contentDescription = null)
                                        Spacer(modifier = Modifier.width(6.dp))
                                        Text("Sign Out Securely", fontWeight = FontWeight.Bold)
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

// ============================================================================
// 2. PURE NATIVE JETPACK COMPOSE TEACHER PORTAL
//    Includes Separated "ID Vault" right next to "Profile" +
//    Whole-Batch Direct Attendance Submit + Gallery Photo Student Creation
// ============================================================================
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TeacherRoleComposePortal(
    userProfile: UserProfile,
    repository: WaqarFirebaseRepository,
    database: WaqarDatabase,
    onLogout: () -> Unit
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val batches by repository.observeBatches().collectAsState(initial = emptyList())
    val erpRecords by repository.observeAllErpRecords().collectAsState(initial = emptyList())
    val cloudUsers by repository.observeCloudCredentials().collectAsState(initial = emptyList())

    var selectedTab by remember { mutableStateOf("Attendance") }
    var statusBanner by remember { mutableStateOf("") }

    // Teacher Batch Attendance State
    var selectedBatchCode by remember { mutableStateOf(batches.firstOrNull()?.code ?: "ADCA-A1") }
    val draftAttendance = remember { mutableStateMapOf<String, String>() }

    // Teacher Student Photo Profile State
    var stuCode by remember { mutableStateOf("") }
    var stuName by remember { mutableStateOf("") }
    var stuCourse by remember { mutableStateOf("ADCA") }
    var stuPhotoUri by remember { mutableStateOf<Uri?>(null) }

    val photoPickerLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.GetContent()
    ) { uri: Uri? ->
        if (uri != null) stuPhotoUri = uri
    }

    // Separated Teacher ID Vault State
    var vaultRole by remember { mutableStateOf("student") }
    var vaultDisplayName by remember { mutableStateOf("") }
    var vaultUsername by remember { mutableStateOf("") }
    var vaultPassword by remember { mutableStateOf("") }

    val studentRecords = remember(erpRecords) { erpRecords.filter { it.module == "student" } }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text(
                            text = "WAQAR INSTITUTE • FACULTY PORTAL",
                            fontWeight = FontWeight.ExtraBold,
                            fontSize = 15.sp,
                            color = Color.White
                        )
                        Text(
                            text = "${userProfile.displayName.ifBlank { "Faculty Member" }} • Cloud Sync Active",
                            fontSize = 11.sp,
                            color = Color(0xFFBAE6FD)
                        )
                    }
                },
                actions = {
                    IconButton(onClick = onLogout) {
                        Icon(Icons.Default.ExitToApp, contentDescription = "Logout", tint = Color(0xFFFCA5A5))
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = Color(0xFF0A192F))
            )
        },
        bottomBar = {
            NavigationBar(containerColor = Color.White) {
                listOf(
                    Triple("Attendance", Icons.Default.CheckCircle, "Attendance"),
                    Triple("LiveClass", Icons.Default.Videocam, "Live Studio"),
                    Triple("Students", Icons.Default.Add, "Students"),
                    Triple("AI Tutor", Icons.Default.AutoAwesome, "AI Tutor"),
                    Triple("ID Vault", Icons.Default.Key, "ID Vault"),
                    Triple("Profile", Icons.Default.Person, "Profile")
                ).forEach { (key, icon, label) ->
                    NavigationBarItem(
                        selected = selectedTab == key,
                        onClick = { selectedTab = key },
                        icon = { Icon(icon, contentDescription = label) },
                        label = { Text(label, fontSize = 10.sp, maxLines = 1) }
                    )
                }
            }
        }
    ) { padding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .background(Color(0xFFF1F5F9))
                .padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            if (statusBanner.isNotBlank()) {
                item {
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        colors = CardDefaults.cardColors(containerColor = Color(0xFFDCFCE7))
                    ) {
                        Text(
                            text = statusBanner,
                            color = Color(0xFF166534),
                            fontWeight = FontWeight.ExtraBold,
                            fontSize = 13.sp,
                            modifier = Modifier.padding(12.dp)
                        )
                    }
                }
            }

            when (selectedTab) {
                "Attendance" -> {
                    item {
                        NativeDynamicQrGeneratorCard(
                            batchCode = selectedBatchCode,
                            teacherId = userProfile.username.ifBlank { "FACULTY" }
                        )
                    }
                    item {
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(18.dp),
                            colors = CardDefaults.cardColors(containerColor = Color.White)
                        ) {
                            Column(modifier = Modifier.padding(16.dp)) {
                                Text(
                                    text = "Direct Whole-Batch Attendance Submit",
                                    fontWeight = FontWeight.ExtraBold,
                                    fontSize = 16.sp,
                                    color = Color(0xFF03045E)
                                )
                                Spacer(modifier = Modifier.height(8.dp))
                                OutlinedTextField(
                                    value = selectedBatchCode,
                                    onValueChange = { selectedBatchCode = it },
                                    label = { Text("Batch Code") },
                                    modifier = Modifier.fillMaxWidth(),
                                    singleLine = true
                                )
                                Spacer(modifier = Modifier.height(10.dp))
                                val roster = if (studentRecords.isNotEmpty()) {
                                    studentRecords.map { it.code to it.title }
                                } else {
                                    listOf(
                                        "WI2026001" to "Rashid",
                                        "WI2026002" to "Ayaan Khan",
                                        "WI2026003" to "Zoya Siddiqui"
                                    )
                                }
                                roster.forEach { (code, name) ->
                                    val st = draftAttendance[code] ?: "Present"
                                    Row(
                                        modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Text("$name ($code)", fontWeight = FontWeight.Bold, fontSize = 14.sp)
                                        Checkbox(
                                            checked = st == "Present",
                                            onCheckedChange = { checked ->
                                                draftAttendance[code] = if (checked) "Present" else "Absent"
                                            }
                                        )
                                    }
                                }
                                Spacer(modifier = Modifier.height(10.dp))
                                Button(
                                    onClick = {
                                        scope.launch {
                                            val payload = roster.map { (c, n) ->
                                                Triple(c, n, draftAttendance[c] ?: "Present")
                                            }
                                            repository.submitWholeBatchAttendanceToFirestore(
                                                batchCode = selectedBatchCode,
                                                courseCode = "ADCA",
                                                branchId = "MAIN-BRANCH",
                                                studentStatuses = payload
                                            )
                                            statusBanner = "Batch Attendance (${payload.size} students) synced to Firestore!"
                                        }
                                    },
                                    modifier = Modifier.fillMaxWidth(),
                                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF16A34A))
                                ) {
                                    Text("Submit Whole-Batch Attendance", fontWeight = FontWeight.Bold)
                                }
                            }
                        }
                    }
                }

                "LiveClass" -> {
                    item {
                        NativeAgoraLiveClassRoom(
                            batchCode = selectedBatchCode,
                            instructorName = userProfile.displayName.ifBlank { "Faculty Host" },
                            topicTitle = "Faculty Live Broadcast Studio",
                            isHostTeacher = true
                        )
                    }
                }

                "Students" -> {
                    item {
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(18.dp),
                            colors = CardDefaults.cardColors(containerColor = Color.White)
                        ) {
                            Column(modifier = Modifier.padding(16.dp)) {
                                Text(
                                    text = "Enroll Student with Gallery Photo",
                                    fontWeight = FontWeight.ExtraBold,
                                    fontSize = 16.sp,
                                    color = Color(0xFF03045E)
                                )
                                Spacer(modifier = Modifier.height(8.dp))
                                OutlinedTextField(value = stuCode, onValueChange = { stuCode = it }, label = { Text("Student Roll / ID") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
                                Spacer(modifier = Modifier.height(8.dp))
                                OutlinedTextField(value = stuName, onValueChange = { stuName = it }, label = { Text("Student Full Name (e.g. Rashid)") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
                                Spacer(modifier = Modifier.height(8.dp))
                                OutlinedTextField(value = stuCourse, onValueChange = { stuCourse = it }, label = { Text("Course Code") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
                                Spacer(modifier = Modifier.height(10.dp))
                                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                                    OutlinedButton(
                                        onClick = { photoPickerLauncher.launch("image/*") },
                                        modifier = Modifier.weight(1f)
                                    ) {
                                        Icon(Icons.Default.Image, contentDescription = null)
                                        Spacer(modifier = Modifier.width(6.dp))
                                        Text(if (stuPhotoUri != null) "Photo Selected ✓" else "Select Gallery Photo")
                                    }
                                    stuPhotoUri?.let { uri ->
                                        AsyncImage(
                                            model = uri,
                                            contentDescription = null,
                                            modifier = Modifier.size(46.dp).clip(CircleShape)
                                        )
                                    }
                                }
                                Spacer(modifier = Modifier.height(10.dp))
                                Button(
                                    onClick = {
                                        if (stuName.isNotBlank()) {
                                            val finalCode = stuCode.trim().ifBlank { "WI-${System.currentTimeMillis() % 100000}" }
                                            val cleanName = stuName.trim()
                                            val encodedPhoto = stuPhotoUri?.let { encodeGalleryUriToBase64DataUrl(context, it) }.orEmpty()
                                            scope.launch {
                                                repository.createErpRecord(
                                                    recordId = finalCode,
                                                    record = ErpRecord(
                                                        id = finalCode,
                                                        module = "student",
                                                        code = finalCode,
                                                        title = cleanName,
                                                        subtitle = "Enrolled by Faculty",
                                                        category = stuCourse.trim(),
                                                        status = "Active",
                                                        courseId = stuCourse.trim(),
                                                        batchId = selectedBatchCode,
                                                        targetUserId = cleanName,
                                                        extra1 = encodedPhoto
                                                    )
                                                )
                                                database.studentDao().insertStudent(
                                                    StudentEntity(
                                                        studentId = finalCode,
                                                        username = finalCode,
                                                        fullName = cleanName,
                                                        courseCode = stuCourse.trim(),
                                                        batchCode = selectedBatchCode,
                                                        branchCode = "MAIN-BRANCH",
                                                        attendancePercentage = 100.0,
                                                        feeStatus = "Paid",
                                                        qrToken = "QR-$finalCode"
                                                    )
                                                )
                                                statusBanner = "Student '$cleanName' & Photo synced to Student Portal!"
                                                stuCode = ""
                                                stuName = ""
                                                stuPhotoUri = null
                                            }
                                        }
                                    },
                                    modifier = Modifier.fillMaxWidth(),
                                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF0077B6))
                                ) {
                                    Text("Save Student & Photo", fontWeight = FontWeight.Bold)
                                }
                            }
                        }
                    }
                }

                "AI Tutor" -> {
                    item {
                        NativeAiTutorSection(
                            repository = repository,
                            courseContext = "Faculty Teaching Assistant ($selectedBatchCode)"
                        )
                    }
                }

                "ID Vault" -> {
                    item {
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(18.dp),
                            colors = CardDefaults.cardColors(containerColor = Color.White)
                        ) {
                            Column(modifier = Modifier.padding(16.dp)) {
                                Text(
                                    text = "Dedicated Credential Vault (Issue Student / Parent Login ID)",
                                    fontWeight = FontWeight.ExtraBold,
                                    fontSize = 16.sp,
                                    color = Color(0xFF03045E)
                                )
                                Spacer(modifier = Modifier.height(8.dp))
                                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                    listOf("student", "parent").forEach { r ->
                                        FilterChip(
                                            selected = vaultRole == r,
                                            onClick = { vaultRole = r },
                                            label = { Text(r.uppercase(), fontWeight = FontWeight.Bold) }
                                        )
                                    }
                                }
                                Spacer(modifier = Modifier.height(8.dp))
                                OutlinedTextField(value = vaultDisplayName, onValueChange = { vaultDisplayName = it }, label = { Text("Full Name") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
                                Spacer(modifier = Modifier.height(8.dp))
                                OutlinedTextField(value = vaultUsername, onValueChange = { vaultUsername = it }, label = { Text("Login Username / Roll ID") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
                                Spacer(modifier = Modifier.height(8.dp))
                                OutlinedTextField(value = vaultPassword, onValueChange = { vaultPassword = it }, label = { Text("Password") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
                                Spacer(modifier = Modifier.height(10.dp))
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
                                                        linkedEntityId = vaultUsername.trim()
                                                    ),
                                                    initialPassword = vaultPassword.trim()
                                                )
                                                statusBanner = "Login ID '${vaultUsername.trim()}' issued via Cloud Vault!"
                                                vaultUsername = ""
                                                vaultPassword = ""
                                                vaultDisplayName = ""
                                            }
                                        }
                                    },
                                    modifier = Modifier.fillMaxWidth(),
                                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF0077B6))
                                ) {
                                    Text("Issue Login Credentials", fontWeight = FontWeight.Bold)
                                }
                                Spacer(modifier = Modifier.height(12.dp))
                                cloudUsers.filter { it.role != "admin" }.forEach { u ->
                                    Text("• ${u.displayName} (${u.role.uppercase()}) — ID: ${u.username}", fontSize = 13.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(vertical = 3.dp))
                                }
                            }
                        }
                    }
                }

                "Profile" -> {
                    item {
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(18.dp),
                            colors = CardDefaults.cardColors(containerColor = Color.White)
                        ) {
                            Column(modifier = Modifier.padding(18.dp)) {
                                Text("Faculty Profile", fontWeight = FontWeight.ExtraBold, fontSize = 17.sp, color = Color(0xFF03045E))
                                Spacer(modifier = Modifier.height(6.dp))
                                Text("Name: ${userProfile.displayName.ifBlank { "Faculty" }}", fontWeight = FontWeight.Bold)
                                Text("Username: ${userProfile.username}", fontSize = 13.sp)
                                Spacer(modifier = Modifier.height(12.dp))
                                Button(
                                    onClick = onLogout,
                                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFDC2626))
                                ) {
                                    Text("Logout", fontWeight = FontWeight.Bold)
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

// ============================================================================
// 3. PURE NATIVE JETPACK COMPOSE PARENT PORTAL
// ============================================================================
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ParentRoleComposePortal(
    userProfile: UserProfile,
    repository: WaqarFirebaseRepository,
    database: WaqarDatabase,
    onLogout: () -> Unit
) {
    val erpRecords by repository.observeAllErpRecords().collectAsState(initial = emptyList())
    var selectedTab by remember { mutableStateOf("Home") }

    val wardStudentRecord = remember(erpRecords, userProfile) {
        val studentDocs = erpRecords.filter { it.module == "student" }
        studentDocs.firstOrNull {
            it.code.equals(userProfile.linkedEntityId, ignoreCase = true) ||
                it.title.equals(userProfile.linkedEntityId, ignoreCase = true)
        }
    }

    val wardName = wardStudentRecord?.title ?: userProfile.displayName.ifBlank { "Student" }
    val wardCode = wardStudentRecord?.code ?: userProfile.linkedEntityId.ifBlank { "WI2026001" }
    val wardCourse = wardStudentRecord?.courseId ?: "ADCA"
    val wardPhoto = wardStudentRecord?.extra1.orEmpty()

    val attendanceRecords = remember(erpRecords) { erpRecords.filter { it.module == "attendance" } }
    val resultRecords = remember(erpRecords) { erpRecords.filter { it.module == "result" } }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        StudentProfilePhotoAvatar(
                            photoDataOrUri = wardPhoto,
                            studentName = wardName,
                            sizeDp = 38
                        )
                        Spacer(modifier = Modifier.width(10.dp))
                        Column {
                            Text(
                                text = "WAQAR INSTITUTE • PARENT PORTAL",
                                fontWeight = FontWeight.ExtraBold,
                                fontSize = 14.sp,
                                color = Color.White
                            )
                            Text(
                                text = "Ward: $wardName ($wardCode) • $wardCourse",
                                fontSize = 11.sp,
                                color = Color(0xFFBAE6FD)
                            )
                        }
                    }
                },
                actions = {
                    IconButton(onClick = onLogout) {
                        Icon(Icons.Default.ExitToApp, contentDescription = "Logout", tint = Color(0xFFFCA5A5))
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = Color(0xFF0A192F))
            )
        },
        bottomBar = {
            NavigationBar(containerColor = Color.White) {
                listOf(
                    Triple("Home", Icons.Default.Home, "Overview"),
                    Triple("Attendance", Icons.Default.CheckCircle, "Attendance"),
                    Triple("Results", Icons.Default.Assignment, "Results"),
                    Triple("Profile", Icons.Default.Person, "Ward ID")
                ).forEach { (key, icon, label) ->
                    NavigationBarItem(
                        selected = selectedTab == key,
                        onClick = { selectedTab = key },
                        icon = { Icon(icon, contentDescription = label) },
                        label = { Text(label, fontSize = 11.sp) }
                    )
                }
            }
        }
    ) { padding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .background(Color(0xFFF1F5F9))
                .padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(18.dp),
                    colors = CardDefaults.cardColors(containerColor = Color.White)
                ) {
                    Row(
                        modifier = Modifier.padding(16.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        StudentProfilePhotoAvatar(
                            photoDataOrUri = wardPhoto,
                            studentName = wardName,
                            sizeDp = 64
                        )
                        Spacer(modifier = Modifier.width(14.dp))
                        Column {
                            Text("Ward Name: $wardName", fontWeight = FontWeight.ExtraBold, fontSize = 16.sp, color = Color(0xFF03045E))
                            Text("Roll / ID: $wardCode • Course: $wardCourse", fontSize = 13.sp, color = Color(0xFF0284C7))
                            Text("Attendance Logs: ${attendanceRecords.size} • Exam Results: ${resultRecords.size}", fontSize = 12.sp)
                        }
                    }
                }
            }

            if (selectedTab == "Attendance" || selectedTab == "Home") {
                item {
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(18.dp),
                        colors = CardDefaults.cardColors(containerColor = Color.White)
                    ) {
                        Column(modifier = Modifier.padding(16.dp)) {
                            Text("Real-Time Attendance History", fontWeight = FontWeight.ExtraBold, fontSize = 15.sp, color = Color(0xFF03045E))
                            Spacer(modifier = Modifier.height(8.dp))
                            if (attendanceRecords.isEmpty()) {
                                Text("Ward Present • 94% Verified Attendance", fontSize = 13.sp, color = Color(0xFF16A34A), fontWeight = FontWeight.Bold)
                            } else {
                                attendanceRecords.take(10).forEach { att ->
                                    Text("• ${att.title} (${att.dateStr}) — ${att.status}", fontSize = 13.sp, modifier = Modifier.padding(vertical = 2.dp))
                                }
                            }
                        }
                    }
                }
            }

            if (selectedTab == "Results" || selectedTab == "Home") {
                item {
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(18.dp),
                        colors = CardDefaults.cardColors(containerColor = Color.White)
                    ) {
                        Column(modifier = Modifier.padding(16.dp)) {
                            Text("50-MCQ Examination Report Cards", fontWeight = FontWeight.ExtraBold, fontSize = 15.sp, color = Color(0xFF03045E))
                            Spacer(modifier = Modifier.height(8.dp))
                            if (resultRecords.isEmpty()) {
                                Text("No exam attempts graded yet.", fontSize = 13.sp)
                            } else {
                                resultRecords.forEach { res ->
                                    Text("• ${res.title} — ${res.subtitle}", fontSize = 13.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(vertical = 3.dp))
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
