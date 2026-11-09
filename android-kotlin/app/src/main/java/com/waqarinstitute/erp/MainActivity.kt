package com.waqarinstitute.erp

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AdminPanelSettings
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.FamilyRestroom
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.School
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.filled.VisibilityOff
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.lifecycleScope
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.waqarinstitute.erp.data.UserProfile
import com.waqarinstitute.erp.data.WaqarFirebaseRepository
import com.waqarinstitute.erp.data.local.WaqarDatabase
import com.waqarinstitute.erp.security.AppSignatureVerifier
import com.waqarinstitute.erp.security.BaselineProfileInitializer
import com.waqarinstitute.erp.security.DeviceFingerprintManager
import com.waqarinstitute.erp.security.HardwareSecurityModuleVault
import com.waqarinstitute.erp.security.NativeCrashHarvester
import com.waqarinstitute.erp.security.PerfettoFrameBudgetTracer
import com.waqarinstitute.erp.security.TamperZeroizationManager
import com.waqarinstitute.erp.ui.AdminErpComposeScreen
import com.waqarinstitute.erp.ui.ParentRoleComposePortal
import com.waqarinstitute.erp.ui.StudentRoleComposePortal
import com.waqarinstitute.erp.ui.TeacherRoleComposePortal
import com.waqarinstitute.erp.ui.Waqar3DGlassmorphicAuthComposeScreen
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.security.SecureRandom

/**
 * WAQAR COMPUTER INSTITUTE (EDUSYNC ACADEMY) — 100% NATIVE JETPACK COMPOSE ENTRY
 * Unified package `com.waqarinstitute.erp` • Firebase Auth + App Check • Hardware Keystore Attestation
 */
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val database = WaqarDatabase.getDatabase(applicationContext)
        val repository = WaqarFirebaseRepository()

        // 1. Initialize Native Crash Harvester, Anti-Tamper Watchdog & Baseline Profile Warmup
        PerfettoFrameBudgetTracer.traceSection("MainActivity.SecurityBootstrap") {
            runCatching {
                NativeCrashHarvester.initialize(applicationContext)
                TamperZeroizationManager.startKernelAntiTamperWatchdog(applicationContext)
                BaselineProfileInitializer.warmUpAheadOfTimeCompilation(applicationContext)
                AppSignatureVerifier.verifySideloadedApkIntegrity(applicationContext)
            }
        }

        // 2. Generate Hardware Keystore / StrongBox Attestation Statement using a fresh challenge nonce
        lifecycleScope.launch {
            runCatching {
                val challengeNonce = ByteArray(32).also { SecureRandom().nextBytes(it) }
                HardwareSecurityModuleVault().generateAttestedKeyAndSignChallenge(challengeNonce)
                DeviceFingerprintManager.deriveHardwareDeviceBindingTag(
                    context = applicationContext,
                    serverChallenge = challengeNonce
                )
            }
        }

        setContent {
            MaterialTheme(
                colorScheme = lightColorScheme(
                    primary = Color(0xFF0A192F),
                    secondary = Color(0xFF0077B6),
                    tertiary = Color(0xFF00B4D8),
                    background = Color(0xFFF0F8FF),
                    surface = Color.White
                )
            ) {
                WaqarAppNavGraph(
                    repository = repository,
                    database = database
                )
            }
        }
    }
}

@Composable
fun FullScreenWaterfallAndFishBackground() {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(
                Brush.verticalGradient(
                    listOf(
                        Color(0xFFE0F2FE),
                        Color(0xFFBAE6FD),
                        Color(0xFF7DD3FC)
                    )
                )
            )
    )
}

@Composable
fun InstituteLogoAvatar(
    sizeDp: Int = 56,
    modifier: Modifier = Modifier
) {
    Surface(
        modifier = modifier
            .size(sizeDp.dp)
            .clip(RoundedCornerShape(22.dp)),
        shape = RoundedCornerShape(22.dp),
        color = Color.White,
        shadowElevation = 8.dp
    ) {
        Image(
            painter = painterResource(id = R.drawable.institute_logo),
            contentDescription = "Waqar Computer Institute Official Logo",
            modifier = Modifier
                .fillMaxSize()
                .padding(6.dp),
            contentScale = ContentScale.Fit
        )
    }
}

@Composable
fun WaqarAppNavGraph(
    repository: WaqarFirebaseRepository,
    database: WaqarDatabase
) {
    val navController: NavHostController = rememberNavController()
    var activeSessionUser by remember { mutableStateOf(UserProfile()) }

    val branches by repository.observeBranches().collectAsState(initial = emptyList())
    val courses by repository.observeCourses().collectAsState(initial = emptyList())
    val batches by repository.observeBatches().collectAsState(initial = emptyList())
    val erpRecords by repository.observeAllErpRecords().collectAsState(initial = emptyList())
    val cloudUsers by repository.observeCloudCredentials().collectAsState(initial = emptyList())

    NavHost(navController = navController, startDestination = "splash") {
        composable("splash") {
            SplashScreen(onTimeout = {
                navController.navigate("auth_3d") {
                    popUpTo("splash") { inclusive = true }
                }
            })
        }
        composable("auth_3d") {
            Waqar3DGlassmorphicAuthComposeScreen(
                repository = repository,
                onAuthenticated = { verifiedProfile ->
                    activeSessionUser = verifiedProfile
                    val targetRoute = when (verifiedProfile.role.lowercase()) {
                        "admin" -> "admin_portal"
                        "teacher" -> "teacher_portal"
                        "parent" -> "parent_portal"
                        else -> "student_portal"
                    }
                    navController.navigate(targetRoute) {
                        popUpTo("auth_3d") { inclusive = true }
                    }
                }
            )
        }
        composable("welcome") {
            Waqar3DGlassmorphicAuthComposeScreen(
                repository = repository,
                onAuthenticated = { verifiedProfile ->
                    activeSessionUser = verifiedProfile
                    val targetRoute = when (verifiedProfile.role.lowercase()) {
                        "admin" -> "admin_portal"
                        "teacher" -> "teacher_portal"
                        "parent" -> "parent_portal"
                        else -> "student_portal"
                    }
                    navController.navigate(targetRoute) {
                        popUpTo("welcome") { inclusive = true }
                    }
                }
            )
        }
        composable("role_select") {
            Waqar3DGlassmorphicAuthComposeScreen(
                repository = repository,
                onAuthenticated = { verifiedProfile ->
                    activeSessionUser = verifiedProfile
                    val targetRoute = when (verifiedProfile.role.lowercase()) {
                        "admin" -> "admin_portal"
                        "teacher" -> "teacher_portal"
                        "parent" -> "parent_portal"
                        else -> "student_portal"
                    }
                    navController.navigate(targetRoute) {
                        popUpTo("role_select") { inclusive = true }
                    }
                }
            )
        }
        composable("student_portal") {
            StudentRoleComposePortal(
                userProfile = activeSessionUser,
                repository = repository,
                database = database,
                onLogout = {
                    activeSessionUser = UserProfile()
                    navController.navigate("auth_3d") {
                        popUpTo(0) { inclusive = true }
                    }
                }
            )
        }
        composable("teacher_portal") {
            TeacherRoleComposePortal(
                userProfile = activeSessionUser,
                repository = repository,
                database = database,
                onLogout = {
                    activeSessionUser = UserProfile()
                    navController.navigate("auth_3d") {
                        popUpTo(0) { inclusive = true }
                    }
                }
            )
        }
        composable("parent_portal") {
            ParentRoleComposePortal(
                userProfile = activeSessionUser,
                repository = repository,
                database = database,
                onLogout = {
                    activeSessionUser = UserProfile()
                    navController.navigate("auth_3d") {
                        popUpTo(0) { inclusive = true }
                    }
                }
            )
        }
        composable("admin_portal") {
            AdminErpComposeScreen(
                userProfile = activeSessionUser,
                repository = repository,
                database = database,
                branches = branches,
                courses = courses,
                batches = batches,
                erpRecords = erpRecords,
                cloudUsers = cloudUsers,
                onLogout = {
                    activeSessionUser = UserProfile()
                    navController.navigate("auth_3d") {
                        popUpTo(0) { inclusive = true }
                    }
                }
            )
        }
    }
}

@Composable
fun SplashScreen(onTimeout: () -> Unit) {
    LaunchedEffect(Unit) {
        delay(1200L)
        onTimeout()
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(
                Brush.verticalGradient(
                    listOf(Color(0xFF0A192F), Color(0xFF0077B6), Color(0xFF00B4D8))
                )
            ),
        contentAlignment = Alignment.Center
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            InstituteLogoAvatar(sizeDp = 128)
            Spacer(modifier = Modifier.height(20.dp))
            Text(
                text = "WAQAR COMPUTER INSTITUTE",
                fontSize = 24.sp,
                fontWeight = FontWeight.ExtraBold,
                color = Color.White,
                textAlign = TextAlign.Center
            )
            Spacer(modifier = Modifier.height(6.dp))
            Text(
                text = "Pure Native Jetpack Compose • Firebase Auth • StrongBox Keystore",
                fontSize = 12.sp,
                color = Color(0xFFCAF0F8),
                textAlign = TextAlign.Center
            )
        }
    }
}

@Composable
fun WelcomeScreen(onLoginClick: () -> Unit) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(
                Brush.verticalGradient(
                    listOf(Color(0xFF90E0EF), Color(0xFF48CAE4), Color(0xFF0096C7))
                )
            )
            .padding(24.dp)
    ) {
        InstituteLogoAvatar(
            sizeDp = 58,
            modifier = Modifier.align(Alignment.TopStart)
        )

        Column(
            modifier = Modifier.align(Alignment.Center),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            InstituteLogoAvatar(sizeDp = 120)
            Spacer(modifier = Modifier.height(16.dp))
            Text(
                text = "Welcome to\nWAQAR COMPUTER INSTITUTE",
                fontSize = 28.sp,
                fontWeight = FontWeight.ExtraBold,
                color = Color(0xFF0A192F),
                textAlign = TextAlign.Center,
                lineHeight = 34.sp
            )
            Spacer(modifier = Modifier.height(12.dp))
            Text(
                text = "100% Native Android ERP • 50-MCQ Proctored Exams • Live Agora Classroom • EduSense AI Tutor",
                fontSize = 14.sp,
                color = Color(0xFF0A192F).copy(alpha = 0.85f),
                textAlign = TextAlign.Center
            )
            Spacer(modifier = Modifier.height(32.dp))
            Button(
                onClick = onLoginClick,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(56.dp),
                shape = RoundedCornerShape(28.dp),
                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF0077B6))
            ) {
                Text("Proceed to Role Portals", fontSize = 18.sp, fontWeight = FontWeight.Bold, color = Color.White)
            }
        }
    }
}

@Composable
fun RoleSelectionScreen(onSelectRole: (String) -> Unit) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(
                Brush.verticalGradient(
                    listOf(Color(0xFF90E0EF), Color(0xFF48CAE4), Color(0xFF0096C7))
                )
            )
            .padding(24.dp)
    ) {
        InstituteLogoAvatar(
            sizeDp = 54,
            modifier = Modifier.align(Alignment.TopStart)
        )

        Column(
            modifier = Modifier.fillMaxSize(),
            verticalArrangement = Arrangement.Center,
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(
                text = "Select Your Role Portal",
                fontSize = 26.sp,
                fontWeight = FontWeight.ExtraBold,
                color = Color(0xFF0A192F)
            )
            Spacer(modifier = Modifier.height(6.dp))
            Text(
                text = "Pure Native Jetpack Compose • Real-Time Firebase Cloud Sync",
                fontSize = 13.sp,
                color = Color(0xFF0A192F).copy(alpha = 0.75f)
            )
            Spacer(modifier = Modifier.height(24.dp))

            val roles = listOf(
                Triple("student", "Student Portal", "50-MCQ Exams, Live Class, QR Attendance, Gemini AI Tutor"),
                Triple("teacher", "Teacher Portal", "Whole-Batch Attendance, 5-Min QR, Live Studio, ID Vault"),
                Triple("parent", "Parent Portal", "Real-Time Ward Attendance, Report Cards & Fee Status"),
                Triple("admin", "Admin ERP Portal (Locked)", "19 ERP Modules, ID Vault, Branches, Fees & Security")
            )

            roles.forEach { (key, title, subtitle) ->
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 7.dp)
                        .clickable { onSelectRole(key) },
                    shape = RoundedCornerShape(18.dp),
                    colors = CardDefaults.cardColors(containerColor = Color.White.copy(alpha = 0.94f)),
                    elevation = CardDefaults.cardElevation(defaultElevation = 4.dp)
                ) {
                    Row(
                        modifier = Modifier.padding(18.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(
                            imageVector = when (key) {
                                "student" -> Icons.Default.School
                                "teacher" -> Icons.Default.Person
                                "parent" -> Icons.Default.FamilyRestroom
                                else -> Icons.Default.AdminPanelSettings
                            },
                            contentDescription = title,
                            tint = Color(0xFF0077B6),
                            modifier = Modifier.size(34.dp)
                        )
                        Spacer(modifier = Modifier.width(14.dp))
                        Column(modifier = Modifier.weight(1f)) {
                            Text(title, fontWeight = FontWeight.ExtraBold, fontSize = 16.sp, color = Color(0xFF0A192F))
                            Text(subtitle, fontSize = 12.sp, color = Color.DarkGray)
                        }
                        Icon(Icons.Default.ChevronRight, contentDescription = null, tint = Color(0xFF0077B6))
                    }
                }
            }
        }
    }
}

@Composable
fun LoginCredentialsScreen(
    role: String,
    repository: WaqarFirebaseRepository,
    onBack: () -> Unit,
    onAuthenticated: (UserProfile) -> Unit
) {
    val isAdminRole = role.equals("admin", ignoreCase = true)
    var username by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var showPassword by remember { mutableStateOf(false) }
    var errorMsg by remember { mutableStateOf("") }
    var isAuthenticating by remember { mutableStateOf(false) }
    var showAdminForgotDialog by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(
                Brush.verticalGradient(
                    listOf(Color(0xFF90E0EF), Color(0xFF48CAE4))
                )
            )
            .padding(24.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .align(Alignment.TopStart),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            InstituteLogoAvatar(sizeDp = 54)
            TextButton(onClick = onBack) {
                Icon(Icons.Default.ArrowBack, contentDescription = null, tint = Color(0xFF0A192F))
                Spacer(modifier = Modifier.width(4.dp))
                Text("Roles", color = Color(0xFF0A192F), fontWeight = FontWeight.Bold)
            }
        }

        Column(
            modifier = Modifier
                .fillMaxWidth()
                .align(Alignment.Center),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Icon(
                imageVector = if (isAdminRole) Icons.Default.Lock else Icons.Default.School,
                contentDescription = null,
                tint = Color(0xFF0077B6),
                modifier = Modifier.size(60.dp)
            )
            Spacer(modifier = Modifier.height(10.dp))
            Text(
                text = "${role.replaceFirstChar { it.uppercase() }} Portal Login",
                fontSize = 24.sp,
                fontWeight = FontWeight.ExtraBold,
                color = Color(0xFF0A192F)
            )
            Text(
                text = if (isAdminRole) {
                    "Protected Admin ERP • Firebase Authentication + Role Claim Verification"
                } else {
                    "Enter the Username & Password issued by Admin / Teacher"
                },
                fontSize = 12.sp,
                color = Color(0xFF0A192F).copy(alpha = 0.78f),
                textAlign = TextAlign.Center
            )
            Spacer(modifier = Modifier.height(22.dp))

            OutlinedTextField(
                value = username,
                onValueChange = { username = it; errorMsg = "" },
                label = { Text(if (isAdminRole) "Admin Username or Email" else "Username / Enrollment ID") },
                leadingIcon = { Icon(Icons.Default.Person, contentDescription = null) },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(14.dp),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedContainerColor = Color.White,
                    unfocusedContainerColor = Color.White
                )
            )
            Spacer(modifier = Modifier.height(14.dp))

            OutlinedTextField(
                value = password,
                onValueChange = { password = it; errorMsg = "" },
                label = { Text("Enter your password") },
                leadingIcon = { Icon(Icons.Default.Lock, contentDescription = null) },
                trailingIcon = {
                    IconButton(onClick = { showPassword = !showPassword }) {
                        Icon(
                            if (showPassword) Icons.Default.VisibilityOff else Icons.Default.Visibility,
                            contentDescription = "Toggle password"
                        )
                    }
                },
                visualTransformation = if (showPassword) VisualTransformation.None else PasswordVisualTransformation(),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(14.dp),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedContainerColor = Color.White,
                    unfocusedContainerColor = Color.White
                )
            )

            // Only Admin Portal shows "Forgot Password?"
            if (isAdminRole) {
                Spacer(modifier = Modifier.height(8.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.End
                ) {
                    Text(
                        text = "Forgot Password?",
                        color = Color(0xFF0A192F),
                        fontWeight = FontWeight.Bold,
                        fontSize = 13.sp,
                        modifier = Modifier.clickable { showAdminForgotDialog = true }
                    )
                }
            } else {
                Spacer(modifier = Modifier.height(18.dp))
            }

            if (errorMsg.isNotEmpty()) {
                Spacer(modifier = Modifier.height(8.dp))
                Surface(
                    color = Color(0xFFFEE2E2),
                    shape = RoundedCornerShape(10.dp),
                    border = BorderStroke(1.dp, Color(0xFFEF4444)),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text(
                        text = errorMsg,
                        color = Color(0xFFB91C1C),
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.padding(10.dp)
                    )
                }
            }

            Spacer(modifier = Modifier.height(18.dp))
            Button(
                onClick = {
                    if (username.isBlank() || password.isBlank()) {
                        errorMsg = "Please enter both username and password."
                        return@Button
                    }
                    isAuthenticating = true
                    scope.launch {
                        val result = repository.authenticateWithPortalRole(
                            usernameInput = username,
                            passwordInput = password,
                            selectedPortal = role.lowercase()
                        )
                        isAuthenticating = false
                        result.onSuccess { profile ->
                            onAuthenticated(profile)
                        }.onFailure { err ->
                            errorMsg = err.message ?: "Invalid credentials."
                        }
                    }
                },
                enabled = !isAuthenticating,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(54.dp),
                shape = RoundedCornerShape(27.dp),
                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF0077B6))
            ) {
                Text(
                    if (isAuthenticating) "Verifying Credentials..." else "Login to ${role.replaceFirstChar { it.uppercase() }} Portal",
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color.White
                )
            }
        }
    }

    if (showAdminForgotDialog && isAdminRole) {
        var adminEmailForReset by remember { mutableStateOf(username) }
        var resetFeedback by remember { mutableStateOf("") }

        AlertDialog(
            onDismissRequest = { showAdminForgotDialog = false },
            title = {
                Text("Admin Password Recovery", fontWeight = FontWeight.ExtraBold)
            },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text(
                        text = "Enter your registered Admin username or email to receive a Firebase Authentication password reset link.",
                        fontSize = 13.sp
                    )
                    OutlinedTextField(
                        value = adminEmailForReset,
                        onValueChange = { adminEmailForReset = it; resetFeedback = "" },
                        label = { Text("Admin Username or Email") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )
                    if (resetFeedback.isNotBlank()) {
                        Text(
                            text = resetFeedback,
                            color = if (resetFeedback.startsWith("Password reset link sent")) Color(0xFF166534) else Color(0xFFB91C1C),
                            fontWeight = FontWeight.Bold,
                            fontSize = 12.sp
                        )
                    }
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        scope.launch {
                            val res = repository.sendAdminPasswordResetEmail(adminEmailForReset)
                            res.onSuccess { msg ->
                                resetFeedback = msg
                            }.onFailure { err ->
                                resetFeedback = err.message ?: "Failed to send password reset email."
                            }
                        }
                    }
                ) {
                    Text("Send Reset Email")
                }
            },
            dismissButton = {
                TextButton(onClick = { showAdminForgotDialog = false }) {
                    Text("Close")
                }
            }
        )
    }
}
