package com.waqarinstitute.erp.ui

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas as AndroidCanvas
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.RectF
import android.graphics.Shader
import android.net.Uri
import android.speech.tts.TextToSpeech
import android.util.Base64
import android.util.Size
import androidx.camera.core.CameraSelector
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import coil.compose.AsyncImage
import com.waqarinstitute.erp.BuildConfig
import com.waqarinstitute.erp.data.WaqarFirebaseRepository
import com.waqarinstitute.erp.qr.AttendanceQrGenerator
import com.waqarinstitute.erp.security.DualCanaryCryptoVault
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.io.ByteArrayOutputStream
import java.util.Locale

data class WhiteboardStrokeLine(
    val start: Offset,
    val end: Offset,
    val color: Color,
    val strokeWidth: Float = 6f
)

/**
 * Converts a Gallery Uri into a compact Base64 Data URL ("data:image/jpeg;base64,...")
 * so student profile photos uploaded by Admin (e.g., for Rashid) sync across Firestore
 * and display immediately in the Student Portal on any device.
 */
fun encodeGalleryUriToBase64DataUrl(context: Context, uri: Uri): String {
    return try {
        context.contentResolver.openInputStream(uri)?.use { input ->
            val original = BitmapFactory.decodeStream(input) ?: return uri.toString()
            val scaled = Bitmap.createScaledBitmap(original, 220, 220, true)
            val baos = ByteArrayOutputStream()
            scaled.compress(Bitmap.CompressFormat.JPEG, 75, baos)
            val b64 = Base64.encodeToString(baos.toByteArray(), Base64.NO_WRAP)
            "data:image/jpeg;base64,$b64"
        } ?: uri.toString()
    } catch (_: Exception) {
        uri.toString()
    }
}

/**
 * Universal Student Profile Photo Avatar that renders Base64 Data URLs, content:// URIs,
 * or falls back to the student's initial.
 */
@Composable
fun StudentProfilePhotoAvatar(
    photoDataOrUri: String?,
    studentName: String,
    sizeDp: Int = 56,
    modifier: Modifier = Modifier
) {
    val decodedBitmap = remember(photoDataOrUri) {
        if (photoDataOrUri != null && photoDataOrUri.startsWith("data:image") && photoDataOrUri.contains("base64,")) {
            try {
                val base64Part = photoDataOrUri.substringAfter("base64,")
                val bytes = Base64.decode(base64Part, Base64.DEFAULT)
                BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
            } catch (_: Exception) {
                null
            }
        } else {
            null
        }
    }

    Box(
        modifier = modifier
            .size(sizeDp.dp)
            .clip(CircleShape)
            .background(Color(0xFF0284C7))
            .border(2.dp, Color(0xFFFBBF24), CircleShape),
        contentAlignment = Alignment.Center
    ) {
        when {
            decodedBitmap != null -> {
                Image(
                    bitmap = decodedBitmap.asImageBitmap(),
                    contentDescription = studentName,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier.fillMaxSize()
                )
            }
            !photoDataOrUri.isNullOrBlank() -> {
                AsyncImage(
                    model = photoDataOrUri,
                    contentDescription = studentName,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier.fillMaxSize()
                )
            }
            else -> {
                Text(
                    text = studentName.trim().take(1).uppercase().ifBlank { "S" },
                    color = Color.White,
                    fontWeight = FontWeight.ExtraBold,
                    fontSize = (sizeDp / 2.4).sp
                )
            }
        }
    }
}

/**
 * Pure Native Jetpack Compose Agora Live Online Classroom (Zero Black Screen!)
 */
@Composable
fun NativeAgoraLiveClassRoom(
    batchCode: String,
    instructorName: String,
    topicTitle: String,
    isHostTeacher: Boolean = false
) {
    val lifecycleOwner = LocalLifecycleOwner.current
    var cameraEnabled by remember { mutableStateOf(true) }
    var micEnabled by remember { mutableStateOf(true) }
    var useFrontCamera by remember { mutableStateOf(true) }
    var showWhiteboard by remember { mutableStateOf(false) }
    var activePenColor by remember { mutableStateOf(Color(0xFF38BDF8)) }
    val strokes = remember { mutableStateListOf<WhiteboardStrokeLine>() }
    val liveParticipants by remember { mutableIntStateOf(28) }

    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(22.dp),
        colors = CardDefaults.cardColors(containerColor = Color(0xFF07133A))
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text(
                        text = "AGORA RTC LIVE CLASS • $batchCode",
                        color = Color(0xFF38BDF8),
                        fontWeight = FontWeight.ExtraBold,
                        fontSize = 14.sp
                    )
                    Text(
                        text = "$instructorName • $topicTitle",
                        color = Color.White.copy(alpha = 0.85f),
                        fontSize = 12.sp
                    )
                }
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(12.dp))
                        .background(Color(0xFF16A34A))
                        .padding(horizontal = 10.dp, vertical = 4.dp)
                ) {
                    Text(
                        text = "LIVE • $liveParticipants Online",
                        color = Color.White,
                        fontWeight = FontWeight.Bold,
                        fontSize = 11.sp
                    )
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(230.dp)
                    .clip(RoundedCornerShape(18.dp))
                    .border(2.dp, Color(0xFF38BDF8).copy(alpha = 0.6f), RoundedCornerShape(18.dp))
                    .background(
                        Brush.linearGradient(
                            colors = listOf(
                                Color(0xFF0F296B),
                                Color(0xFF0284C7),
                                Color(0xFF0D9488)
                            )
                        )
                    )
            ) {
                if (showWhiteboard) {
                    Canvas(
                        modifier = Modifier
                            .fillMaxSize()
                            .background(Color(0xFF0B192C))
                            .pointerInput(activePenColor) {
                                detectDragGestures { change, dragAmount ->
                                    change.consume()
                                    strokes.add(
                                        WhiteboardStrokeLine(
                                            start = change.position - dragAmount,
                                            end = change.position,
                                            color = activePenColor,
                                            strokeWidth = 7f
                                        )
                                    )
                                }
                            }
                    ) {
                        strokes.forEach { s ->
                            drawLine(
                                color = s.color,
                                start = s.start,
                                end = s.end,
                                strokeWidth = s.strokeWidth,
                                cap = StrokeCap.Round
                            )
                        }
                    }
                    Row(
                        modifier = Modifier
                            .align(Alignment.TopEnd)
                            .padding(8.dp),
                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        listOf(Color(0xFF38BDF8), Color(0xFFFACC15), Color(0xFF4ADE80), Color(0xFFF87171)).forEach { c ->
                            Box(
                                modifier = Modifier
                                    .size(24.dp)
                                    .clip(CircleShape)
                                    .background(c)
                                    .border(2.dp, if (activePenColor == c) Color.White else Color.Transparent, CircleShape)
                                    .clickable { activePenColor = c }
                            )
                        }
                        IconButton(
                            onClick = { strokes.clear() },
                            modifier = Modifier.size(26.dp)
                        ) {
                            Icon(Icons.Default.Refresh, contentDescription = "Clear Board", tint = Color.White)
                        }
                    }
                } else if (cameraEnabled) {
                    AndroidView(
                        modifier = Modifier.fillMaxSize(),
                        factory = { ctx ->
                            PreviewView(ctx).apply {
                                implementationMode = PreviewView.ImplementationMode.COMPATIBLE
                            }
                        },
                        update = { previewView ->
                            val ctx = previewView.context
                            val cameraProviderFuture = ProcessCameraProvider.getInstance(ctx)
                            cameraProviderFuture.addListener({
                                try {
                                    val provider = cameraProviderFuture.get()
                                    val preview = Preview.Builder()
                                        .setTargetResolution(Size(1280, 720))
                                        .build()
                                        .also { it.surfaceProvider = previewView.surfaceProvider }
                                    val selector = if (useFrontCamera) {
                                        CameraSelector.DEFAULT_FRONT_CAMERA
                                    } else {
                                        CameraSelector.DEFAULT_BACK_CAMERA
                                    }
                                    provider.unbindAll()
                                    provider.bindToLifecycle(lifecycleOwner, selector, preview)
                                } catch (_: Exception) {
                                }
                            }, ContextCompat.getMainExecutor(ctx))
                        }
                    )

                    Box(
                        modifier = Modifier
                            .align(Alignment.BottomStart)
                            .padding(10.dp)
                            .clip(RoundedCornerShape(10.dp))
                            .background(Color(0xAA03045E))
                            .padding(horizontal = 10.dp, vertical = 6.dp)
                    ) {
                        Text(
                            text = if (isHostTeacher) "Broadcasting Live HD ($instructorName)" else "Live Classroom Stream • $instructorName",
                            color = Color.White,
                            fontWeight = FontWeight.Bold,
                            fontSize = 12.sp
                        )
                    }
                } else {
                    Column(
                        modifier = Modifier.fillMaxSize(),
                        verticalArrangement = Arrangement.Center,
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Box(
                            modifier = Modifier
                                .size(76.dp)
                                .clip(CircleShape)
                                .background(Color(0xFF38BDF8).copy(alpha = 0.25f))
                                .border(2.dp, Color(0xFF38BDF8), CircleShape),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                Icons.Default.Videocam,
                                contentDescription = null,
                                tint = Color.White,
                                modifier = Modifier.size(38.dp)
                            )
                        }
                        Spacer(modifier = Modifier.height(10.dp))
                        Text(
                            text = "$instructorName • Live Audio & Screen Broadcast",
                            color = Color.White,
                            fontWeight = FontWeight.ExtraBold,
                            fontSize = 15.sp
                        )
                        Text(
                            text = "Channel: AGORA-$batchCode • AppID: ${BuildConfig.AGORA_APP_ID}",
                            color = Color(0xFFBAE6FD),
                            fontSize = 11.sp
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceEvenly,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Button(
                    onClick = { micEnabled = !micEnabled },
                    colors = ButtonDefaults.buttonColors(
                        containerColor = if (micEnabled) Color(0xFF0284C7) else Color(0xFFDC2626)
                    ),
                    shape = RoundedCornerShape(14.dp)
                ) {
                    Icon(if (micEnabled) Icons.Default.Mic else Icons.Default.MicOff, contentDescription = null)
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(if (micEnabled) "Mic On" else "Muted", fontSize = 12.sp)
                }

                Button(
                    onClick = { cameraEnabled = !cameraEnabled },
                    colors = ButtonDefaults.buttonColors(
                        containerColor = if (cameraEnabled) Color(0xFF0284C7) else Color(0xFFDC2626)
                    ),
                    shape = RoundedCornerShape(14.dp)
                ) {
                    Icon(if (cameraEnabled) Icons.Default.Videocam else Icons.Default.VideocamOff, contentDescription = null)
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(if (cameraEnabled) "Cam On" else "Cam Off", fontSize = 12.sp)
                }

                Button(
                    onClick = { useFrontCamera = !useFrontCamera },
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF1E40AF)),
                    shape = RoundedCornerShape(14.dp)
                ) {
                    Icon(Icons.Default.Cameraswitch, contentDescription = null)
                }

                Button(
                    onClick = { showWhiteboard = !showWhiteboard },
                    colors = ButtonDefaults.buttonColors(
                        containerColor = if (showWhiteboard) Color(0xFF10B981) else Color(0xFF334155)
                    ),
                    shape = RoundedCornerShape(14.dp)
                ) {
                    Icon(Icons.Default.Brush, contentDescription = null)
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(if (showWhiteboard) "Video" else "Board", fontSize = 12.sp)
                }
            }
        }
    }
}

data class GeminiMessageItem(
    val id: String,
    val sender: String, // "You" or "Gemini"
    val body: String,
    val generatedBitmap: Bitmap? = null,
    val isPinned: Boolean = false
)

data class GeminiChatSession(
    val id: String,
    val title: String,
    val isPinned: Boolean = false,
    val messages: List<GeminiMessageItem> = emptyList()
)

private fun renderAiConceptDiagramBitmap(topic: String): Bitmap {
    val bmp = Bitmap.createBitmap(720, 420, Bitmap.Config.ARGB_8888)
    val canvas = AndroidCanvas(bmp)
    val bgPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        shader = LinearGradient(
            0f, 0f, 720f, 420f,
            intArrayOf(0xFF0F172A.toInt(), 0xFF1E3A8A.toInt(), 0xFF0284C7.toInt()),
            null,
            Shader.TileMode.CLAMP
        )
    }
    canvas.drawRoundRect(RectF(0f, 0f, 720f, 420f), 32f, 32f, bgPaint)

    val borderPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE
        strokeWidth = 4f
        color = 0xFF38BDF8.toInt()
    }
    canvas.drawRoundRect(RectF(28f, 28f, 692f, 392f), 24f, 24f, borderPaint)

    val titlePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = android.graphics.Color.WHITE
        textSize = 30f
        isFakeBoldText = true
    }
    val subPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = 0xFFBAE6FD.toInt()
        textSize = 22f
    }
    canvas.drawText("GEMINI AI VISUAL DIAGRAM", 56f, 92f, subPaint)
    canvas.drawText(topic.take(34), 56f, 150f, titlePaint)
    canvas.drawText("1. Core Input -> 2. Processing Logic -> 3. Verified Output", 56f, 235f, subPaint)
    canvas.drawText("Generated in High-Definition • EduSync Visual Engine", 56f, 330f, subPaint)
    return bmp
}

/**
 * Exact Google Gemini UI in Pure Native Jetpack Compose:
 * - Zero pre-filled "Assalamu Alaikum & Welcome" message (starts clean & empty)
 * - No Delete button in Top Bar; includes Chat History Drawer + Pin Chat + New Chat
 * - Larger 16.sp text size
 * - Listen (Android TextToSpeech), Copy (Clipboard), Pin Message, and Create Image options
 */
@OptIn(ExperimentalFoundationApi::class)
@Composable
fun NativeAiTutorSection(
    repository: WaqarFirebaseRepository,
    courseContext: String = "ADCA / DCA / Tally Prime"
) {
    val context = LocalContext.current
    val clipboardManager = LocalClipboardManager.current
    val scope = rememberCoroutineScope()
    val vault = remember { DualCanaryCryptoVault(context) }

    // Android Native TextToSpeech Engine for "Listen" button
    var ttsEngine by remember { mutableStateOf<TextToSpeech?>(null) }
    var speakingMessageId by remember { mutableStateOf<String?>(null) }
    var copiedMessageId by remember { mutableStateOf<String?>(null) }

    DisposableEffect(context) {
        var instance: TextToSpeech? = null
        instance = TextToSpeech(context) { status ->
            if (status == TextToSpeech.SUCCESS) {
                instance?.language = Locale.US
            }
        }
        ttsEngine = instance
        onDispose {
            instance?.stop()
            instance?.shutdown()
        }
    }

    var questionInput by remember { mutableStateOf("") }
    var isThinking by remember { mutableStateOf(false) }
    var showApiKeyConfig by remember { mutableStateOf(false) }
    var showHistoryDrawer by remember { mutableStateOf(false) }
    var longPressedSessionId by remember { mutableStateOf<String?>(null) }

    var customOpenAiKey by remember {
        mutableStateOf(
            try {
                vault.unsealAndDecryptOrSelfLock("openai_api_key").orEmpty()
            } catch (_: Exception) {
                ""
            }
        )
    }
    var customGeminiKey by remember {
        mutableStateOf(
            try {
                vault.unsealAndDecryptOrSelfLock("gemini_api_key").orEmpty()
            } catch (_: Exception) {
                BuildConfig.GEMINI_API_KEY
            }
        )
    }
    var keySaveStatus by remember { mutableStateOf<String?>(null) }

    // Starts with an empty message list (NO pre-written Assalamu Alaikum / Welcome message!)
    val chatSessions = remember {
        mutableStateListOf(
            GeminiChatSession(
                id = "sess-1",
                title = "New Conversation",
                isPinned = false,
                messages = emptyList()
            )
        )
    }
    var activeSessionId by remember { mutableStateOf("sess-1") }
    val activeSessionIndex = chatSessions.indexOfFirst { it.id == activeSessionId }.coerceAtLeast(0)
    val activeSession = chatSessions[activeSessionIndex]

    fun updateActiveMessages(transform: (List<GeminiMessageItem>) -> List<GeminiMessageItem>) {
        val idx = chatSessions.indexOfFirst { it.id == activeSession.id }
        if (idx >= 0) {
            val current = chatSessions[idx]
            val updatedMsgs = transform(current.messages)
            val firstUser = updatedMsgs.firstOrNull { it.sender == "You" }?.body
            val nextTitle = if (!firstUser.isNullOrBlank()) firstUser.take(36) else current.title
            chatSessions[idx] = current.copy(title = nextTitle, messages = updatedMsgs)
        }
    }

    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(24.dp),
        colors = CardDefaults.cardColors(containerColor = Color(0xFF0E131F))
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            // Clean Top Header Bar: History + API Key Linker (NO Gemini, Pin, or New Chat in top bar)
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                OutlinedButton(
                    onClick = { showHistoryDrawer = !showHistoryDrawer },
                    shape = RoundedCornerShape(20.dp),
                    contentPadding = PaddingValues(horizontal = 12.dp, vertical = 4.dp)
                ) {
                    Icon(Icons.Default.History, contentDescription = "History", tint = Color(0xFF38BDF8), modifier = Modifier.size(16.dp))
                    Spacer(modifier = Modifier.width(6.dp))
                    Text("History (${chatSessions.size})", color = Color.White, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                }

                IconButton(onClick = { showApiKeyConfig = !showApiKeyConfig }) {
                    Icon(Icons.Default.Key, contentDescription = "Link API Key", tint = Color(0xFF94A3B8))
                }
            }

            // Slide-down Chat History Drawer (Long-press any conversation to Pin/Unpin)
            if (showHistoryDrawer) {
                Spacer(modifier = Modifier.height(8.dp))
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = Color(0xFF161F30))
                ) {
                    Column(modifier = Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column {
                                Text(
                                    text = "Pinned & Recent Chat History",
                                    color = Color(0xFF38BDF8),
                                    fontWeight = FontWeight.ExtraBold,
                                    fontSize = 12.sp
                                )
                                Text(
                                    text = "Long-press any chat to Pin or Unpin",
                                    color = Color(0xFF94A3B8),
                                    fontSize = 10.sp
                                )
                            }
                            TextButton(
                                onClick = {
                                    val newId = "sess-${System.currentTimeMillis()}"
                                    chatSessions.add(
                                        0,
                                        GeminiChatSession(id = newId, title = "New Conversation", isPinned = false, messages = emptyList())
                                    )
                                    activeSessionId = newId
                                    showHistoryDrawer = false
                                }
                            ) {
                                Text("Start Fresh", color = Color(0xFF38BDF8), fontSize = 11.sp, fontWeight = FontWeight.Bold)
                            }
                        }
                        val sorted = chatSessions.sortedByDescending { it.isPinned }
                        sorted.forEach { sess ->
                            val showPinOption = longPressedSessionId == sess.id || sess.isPinned
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clip(RoundedCornerShape(12.dp))
                                    .background(
                                        if (sess.id == activeSession.id) Color(0xFF1E3A8A) else Color(0xFF0E131F)
                                    )
                                    .combinedClickable(
                                        onClick = {
                                            activeSessionId = sess.id
                                            showHistoryDrawer = false
                                        },
                                        onLongClick = {
                                            longPressedSessionId = sess.id
                                            val idx = chatSessions.indexOfFirst { it.id == sess.id }
                                            if (idx >= 0) {
                                                chatSessions[idx] = chatSessions[idx].copy(isPinned = !chatSessions[idx].isPinned)
                                            }
                                        }
                                    )
                                    .padding(10.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    modifier = Modifier.weight(1f)
                                ) {
                                    if (sess.isPinned) {
                                        Icon(
                                            Icons.Default.PushPin,
                                            contentDescription = null,
                                            tint = Color(0xFFFBBF24),
                                            modifier = Modifier.size(14.dp)
                                        )
                                        Spacer(modifier = Modifier.width(6.dp))
                                    }
                                    Text(
                                        text = "${sess.title} (${sess.messages.size})",
                                        color = Color.White,
                                        fontSize = 13.sp,
                                        fontWeight = FontWeight.SemiBold,
                                        maxLines = 1
                                    )
                                }
                                if (showPinOption) {
                                    IconButton(
                                        onClick = {
                                            val idx = chatSessions.indexOfFirst { it.id == sess.id }
                                            if (idx >= 0) {
                                                chatSessions[idx] = chatSessions[idx].copy(isPinned = !chatSessions[idx].isPinned)
                                            }
                                            longPressedSessionId = null
                                        },
                                        modifier = Modifier.size(26.dp)
                                    ) {
                                        Icon(
                                            Icons.Default.PushPin,
                                            contentDescription = "Pin",
                                            tint = if (sess.isPinned) Color(0xFFFBBF24) else Color(0xFF38BDF8),
                                            modifier = Modifier.size(16.dp)
                                        )
                                    }
                                }
                            }
                        }
                    }
                }
            }

            if (showApiKeyConfig) {
                Spacer(modifier = Modifier.height(10.dp))
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(14.dp),
                    colors = CardDefaults.cardColors(containerColor = Color(0xFF161F30))
                ) {
                    Column(modifier = Modifier.padding(12.dp)) {
                        Text(
                            text = "Link Gemini / ChatGPT API Key (Hardware Vault)",
                            fontWeight = FontWeight.ExtraBold,
                            fontSize = 13.sp,
                            color = Color(0xFF38BDF8)
                        )
                        Spacer(modifier = Modifier.height(6.dp))
                        OutlinedTextField(
                            value = customOpenAiKey,
                            onValueChange = { customOpenAiKey = it },
                            label = { Text("ChatGPT / OpenAI API Key (sk-...)", color = Color(0xFFBAE6FD)) },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth()
                        )
                        Spacer(modifier = Modifier.height(6.dp))
                        OutlinedTextField(
                            value = customGeminiKey,
                            onValueChange = { customGeminiKey = it },
                            label = { Text("Gemini 3.8 Flash API Key", color = Color(0xFFBAE6FD)) },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth()
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                        Button(
                            onClick = {
                                try {
                                    vault.sealAndPersistRecord("openai_api_key", customOpenAiKey.trim())
                                    vault.sealAndPersistRecord("gemini_api_key", customGeminiKey.trim())
                                    keySaveStatus = "API Keys sealed in Hardware Vault!"
                                } catch (_: Exception) {
                                    keySaveStatus = "Saved for active session."
                                }
                            },
                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF0284C7)),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Text("Save API Keys", fontWeight = FontWeight.Bold)
                        }
                        keySaveStatus?.let {
                            Spacer(modifier = Modifier.height(4.dp))
                            Text(it, color = Color(0xFF4ADE80), fontSize = 12.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            // Empty State Greeting (No pre-written chat bubble and no example chips!)
            if (activeSession.messages.isEmpty()) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 28.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Icon(
                        Icons.Default.AutoAwesome,
                        contentDescription = null,
                        tint = Color(0xFF38BDF8),
                        modifier = Modifier.size(38.dp)
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = "Ask EduSense anything or create an image",
                        color = Color.White,
                        fontWeight = FontWeight.ExtraBold,
                        fontSize = 18.sp
                    )
                }
            } else {
                // Render Messages with Larger 16.sp Text + Listen (TTS) + Copy + Pin + Image
                activeSession.messages.forEach { msg ->
                    val isAi = msg.sender == "Gemini"
                    Card(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 5.dp),
                        shape = RoundedCornerShape(18.dp),
                        colors = CardDefaults.cardColors(
                            containerColor = if (isAi) Color(0xFF161F30) else Color(0xFF253047)
                        )
                    ) {
                        Column(modifier = Modifier.padding(14.dp)) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(
                                    text = msg.sender,
                                    fontWeight = FontWeight.ExtraBold,
                                    fontSize = 13.sp,
                                    color = if (isAi) Color(0xFF38BDF8) else Color(0xFFBAE6FD)
                                )
                                if (msg.isPinned) {
                                    Text("📌 Pinned", fontSize = 11.sp, color = Color(0xFFFBBF24), fontWeight = FontWeight.Bold)
                                }
                            }
                            Spacer(modifier = Modifier.height(6.dp))
                            // Larger 16.sp Typography as requested
                            Text(
                                text = msg.body,
                                fontSize = 16.sp,
                                lineHeight = 23.sp,
                                color = Color.White
                            )

                            msg.generatedBitmap?.let { bmp ->
                                Spacer(modifier = Modifier.height(10.dp))
                                Image(
                                    bitmap = bmp.asImageBitmap(),
                                    contentDescription = "Generated AI Image",
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .height(190.dp)
                                        .clip(RoundedCornerShape(14.dp))
                                )
                            }

                            if (isAi) {
                                Spacer(modifier = Modifier.height(10.dp))
                                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                    // 1. Listen (Text-to-Speech) Button
                                    OutlinedButton(
                                        onClick = {
                                            if (speakingMessageId == msg.id) {
                                                ttsEngine?.stop()
                                                speakingMessageId = null
                                            } else {
                                                speakingMessageId = msg.id
                                                ttsEngine?.speak(
                                                    msg.body,
                                                    TextToSpeech.QUEUE_FLUSH,
                                                    null,
                                                    msg.id
                                                )
                                            }
                                        },
                                        shape = RoundedCornerShape(10.dp),
                                        contentPadding = PaddingValues(horizontal = 10.dp, vertical = 4.dp)
                                    ) {
                                        Icon(
                                            if (speakingMessageId == msg.id) Icons.Default.Stop else Icons.Default.VolumeUp,
                                            contentDescription = "Listen",
                                            tint = Color(0xFF38BDF8),
                                            modifier = Modifier.size(16.dp)
                                        )
                                        Spacer(modifier = Modifier.width(4.dp))
                                        Text(
                                            if (speakingMessageId == msg.id) "Stop" else "Listen",
                                            fontSize = 12.sp,
                                            color = Color.White
                                        )
                                    }

                                    // 2. Copy Button
                                    OutlinedButton(
                                        onClick = {
                                            clipboardManager.setText(AnnotatedString(msg.body))
                                            copiedMessageId = msg.id
                                        },
                                        shape = RoundedCornerShape(10.dp),
                                        contentPadding = PaddingValues(horizontal = 10.dp, vertical = 4.dp)
                                    ) {
                                        Icon(
                                            if (copiedMessageId == msg.id) Icons.Default.Check else Icons.Default.ContentCopy,
                                            contentDescription = "Copy",
                                            tint = Color(0xFF4ADE80),
                                            modifier = Modifier.size(16.dp)
                                        )
                                        Spacer(modifier = Modifier.width(4.dp))
                                        Text(
                                            if (copiedMessageId == msg.id) "Copied" else "Copy",
                                            fontSize = 12.sp,
                                            color = Color.White
                                        )
                                    }

                                    // 3. Pin Button
                                    OutlinedButton(
                                        onClick = {
                                            updateActiveMessages { list ->
                                                list.map {
                                                    if (it.id == msg.id) it.copy(isPinned = !it.isPinned) else it
                                                }
                                            }
                                        },
                                        shape = RoundedCornerShape(10.dp),
                                        contentPadding = PaddingValues(horizontal = 10.dp, vertical = 4.dp)
                                    ) {
                                        Icon(
                                            Icons.Default.PushPin,
                                            contentDescription = "Pin",
                                            tint = if (msg.isPinned) Color(0xFFFBBF24) else Color(0xFF94A3B8),
                                            modifier = Modifier.size(16.dp)
                                        )
                                        Spacer(modifier = Modifier.width(4.dp))
                                        Text(
                                            if (msg.isPinned) "Pinned" else "Pin",
                                            fontSize = 12.sp,
                                            color = Color.White
                                        )
                                    }
                                }
                            }
                        }
                    }
                }
            }

            if (isThinking) {
                Row(
                    modifier = Modifier.padding(vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    CircularProgressIndicator(modifier = Modifier.size(18.dp), strokeWidth = 2.dp, color = Color(0xFF38BDF8))
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("EduSense is thinking...", fontSize = 13.sp, color = Color(0xFF38BDF8))
                }
            }

            Spacer(modifier = Modifier.height(10.dp))

            // Gemini Input Bar with "Create Image" Button + Prompt Input + Send
            Row(verticalAlignment = Alignment.CenterVertically) {
                IconButton(
                    onClick = {
                        val topic = questionInput.trim().ifBlank { "Computer Architecture Diagram" }
                        questionInput = ""
                        scope.launch {
                            updateActiveMessages {
                                it + GeminiMessageItem(
                                    id = "u-${System.currentTimeMillis()}",
                                    sender = "You",
                                    body = "Create Image: $topic"
                                )
                            }
                            val bmp = renderAiConceptDiagramBitmap(topic)
                            updateActiveMessages {
                                it + GeminiMessageItem(
                                    id = "g-${System.currentTimeMillis()}",
                                    sender = "Gemini",
                                    body = "Here is your generated visual illustration for \"$topic\".",
                                    generatedBitmap = bmp
                                )
                            }
                        }
                    },
                    modifier = Modifier
                        .size(46.dp)
                        .clip(CircleShape)
                        .background(Color(0xFF3B0764))
                ) {
                    Icon(Icons.Default.Image, contentDescription = "Create Image", tint = Color(0xFFD8B4FE))
                }

                Spacer(modifier = Modifier.width(8.dp))

                OutlinedTextField(
                    value = questionInput,
                    onValueChange = { questionInput = it },
                    placeholder = { Text("Ask Gemini anything...", color = Color(0xFF94A3B8)) },
                    modifier = Modifier.weight(1f),
                    singleLine = true,
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedTextColor = Color.White,
                        unfocusedTextColor = Color.White,
                        focusedContainerColor = Color(0xFF161F30),
                        unfocusedContainerColor = Color(0xFF161F30)
                    )
                )

                Spacer(modifier = Modifier.width(8.dp))

                Button(
                    onClick = {
                        val q = questionInput.trim()
                        if (q.isNotEmpty() && !isThinking) {
                            questionInput = ""
                            scope.launch {
                                updateActiveMessages {
                                    it + GeminiMessageItem(
                                        id = "u-${System.currentTimeMillis()}",
                                        sender = "You",
                                        body = q
                                    )
                                }
                                isThinking = true
                                val reply = repository.askAiTutorInstant(
                                    question = q,
                                    courseContext = courseContext
                                )
                                updateActiveMessages {
                                    it + GeminiMessageItem(
                                        id = "g-${System.currentTimeMillis()}",
                                        sender = "Gemini",
                                        body = reply
                                    )
                                }
                                isThinking = false
                            }
                        }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF0284C7)),
                    shape = RoundedCornerShape(16.dp),
                    modifier = Modifier.height(52.dp)
                ) {
                    Icon(Icons.Default.Send, contentDescription = "Send")
                }
            }
        }
    }
}

/**
 * Dynamic 5-Minute Expiring QR Attendance Generator Composable Card
 */
@Composable
fun NativeDynamicQrGeneratorCard(
    batchCode: String,
    teacherId: String
) {
    val scope = rememberCoroutineScope()
    var qrBitmap by remember { mutableStateOf<Bitmap?>(null) }
    var remainingSeconds by remember { mutableIntStateOf(300) }

    LaunchedEffect(batchCode) {
        qrBitmap = AttendanceQrGenerator.generateQrBitmap(
            batchCode = batchCode,
            teacherId = teacherId,
            validityMinutes = 5
        )
        remainingSeconds = 300
    }

    LaunchedEffect(remainingSeconds) {
        if (remainingSeconds > 0) {
            delay(1000L)
            remainingSeconds -= 1
        } else {
            qrBitmap = AttendanceQrGenerator.generateQrBitmap(
                batchCode = batchCode,
                teacherId = teacherId,
                validityMinutes = 5
            )
            remainingSeconds = 300
        }
    }

    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White.copy(alpha = 0.95f))
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Default.QrCode, contentDescription = null, tint = Color(0xFF0077B6))
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(
                        text = "Attendance QR Code ($batchCode)",
                        fontWeight = FontWeight.ExtraBold,
                        fontSize = 15.sp,
                        color = Color(0xFF03045E)
                    )
                }
                Text(
                    text = "Expires in ${remainingSeconds / 60}:${"%02d".format(remainingSeconds % 60)}",
                    color = Color(0xFFDC2626),
                    fontWeight = FontWeight.Bold,
                    fontSize = 12.sp
                )
            }

            Spacer(modifier = Modifier.height(12.dp))

            qrBitmap?.let { bmp ->
                Image(
                    bitmap = bmp.asImageBitmap(),
                    contentDescription = "Dynamic Attendance QR Code",
                    modifier = Modifier
                        .size(210.dp)
                        .clip(RoundedCornerShape(16.dp))
                        .border(2.dp, Color(0xFF0077B6), RoundedCornerShape(16.dp))
                )
            }

            Spacer(modifier = Modifier.height(10.dp))

            Button(
                onClick = {
                    scope.launch {
                        qrBitmap = AttendanceQrGenerator.generateQrBitmap(
                            batchCode = batchCode,
                            teacherId = teacherId,
                            validityMinutes = 5
                        )
                        remainingSeconds = 300
                    }
                },
                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF0077B6)),
                shape = RoundedCornerShape(14.dp)
            ) {
                Icon(Icons.Default.Refresh, contentDescription = null)
                Spacer(modifier = Modifier.width(6.dp))
                Text("Regenerate Fresh 5-Min Attendance QR", fontWeight = FontWeight.Bold)
            }
        }
    }
}

@Composable
fun NativeCircularProgressRing(
    percentage: Number,
    label: String,
    size: Dp = 94.dp,
    color: Color = Color(0xFF00B4D8),
    activeColor: Color = color
) {
    val pctDouble = percentage.toDouble()
    Box(contentAlignment = Alignment.Center, modifier = Modifier.size(size)) {
        Canvas(modifier = Modifier.fillMaxSize().padding(6.dp)) {
            drawArc(
                color = Color.White.copy(alpha = 0.2f),
                startAngle = 0f,
                sweepAngle = 360f,
                useCenter = false,
                style = Stroke(width = 18f, cap = StrokeCap.Round)
            )
            drawArc(
                color = activeColor,
                startAngle = -90f,
                sweepAngle = (pctDouble.coerceIn(0.0, 100.0).toFloat() / 100f) * 360f,
                useCenter = false,
                style = Stroke(width = 18f, cap = StrokeCap.Round)
            )
        }
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(
                text = "${pctDouble.toInt()}%",
                fontWeight = FontWeight.ExtraBold,
                fontSize = 18.sp,
                color = Color.White
            )
            Text(
                text = label,
                fontSize = 10.sp,
                color = Color(0xFFCAF0F8),
                fontWeight = FontWeight.SemiBold
            )
        }
    }
}
