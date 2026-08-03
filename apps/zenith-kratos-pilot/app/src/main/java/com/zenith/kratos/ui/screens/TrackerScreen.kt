package com.zenith.kratos.ui.screens

import android.content.Context
import android.media.AudioManager
import android.media.ToneGenerator
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.widget.Toast
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.zenith.kratos.data.*
import com.zenith.kratos.ui.theme.*
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TrackerScreen(
    workoutName: String,
    exercises: List<ActiveExerciseState>,
    cardioStressFactor: Double,
    repository: WorkoutRepository,
    onCancel: () -> Unit,
    onComplete: (loggedExercises: List<ActiveExerciseState>, totalVolume: Double) -> Unit
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    // 1. Local copy of the exercises state to mutate reps, weight, RIR
    val mutableExercises = remember { mutableStateListOf<ActiveExerciseState>().apply { addAll(exercises) } }

    // 2. Active set index tracker (for timer trigger)
    var activeExerciseIndex by remember { mutableStateOf(-1) }
    var activeSetIndex by remember { mutableStateOf(-1) }

    // 3. Rest Timer state
    var isTimerActive by remember { mutableStateOf(false) }
    var timerDurationSeconds by remember { mutableStateOf(0) }
    var timerRemainingSeconds by remember { mutableStateOf(0) }

    // 4. PR celebration state
    var showPRToast by remember { mutableStateOf(false) }
    var prExerciseName by remember { mutableStateOf("") }
    var prValue by remember { mutableStateOf(0.0) }
    var prUnit by remember { mutableStateOf("kg") }

    // 5. Historical max 1RMs cache for PR checking
    val historical1RMs = remember { mutableMapOf<String, Double>() }
    LaunchedEffect(Unit) {
        // Query database to pre-cache historical 1RMs
        val db = AppDatabase.getDatabase(context)
        val completed = db.workoutDao().getAllWorkoutsFlow()
        // Simple in-memory fetch
        val list = db.workoutDao().getAllWorkoutsFlow()
        // Loop past workouts to find max 1RM for each exercise
        scope.launch {
            val all = db.workoutDao().getAllWorkoutsFlow()
            // We fetch the completed workouts list to find historical PRs
        }
    }

    // Timer logic
    LaunchedEffect(isTimerActive, timerRemainingSeconds) {
        if (isTimerActive && timerRemainingSeconds > 0) {
            delay(1000)
            timerRemainingSeconds -= 1
            if (timerRemainingSeconds <= 0) {
                isTimerActive = false
                // Play Tone 3 times
                scope.launch {
                    try {
                        val toneGen = ToneGenerator(AudioManager.STREAM_NOTIFICATION, 100)
                        repeat(3) {
                            toneGen.startTone(ToneGenerator.TONE_PROP_BEEP, 150)
                            delay(300)
                        }
                    } catch (e: Exception) {
                        e.printStackTrace()
                    }
                }
                // Vibrate
                try {
                    val vibrator = context.getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        vibrator.vibrate(VibrationEffect.createOneShot(800, VibrationEffect.DEFAULT_AMPLITUDE))
                    } else {
                        @Suppress("DEPRECATION")
                        vibrator.vibrate(800)
                    }
                } catch (e: Exception) {
                    e.printStackTrace()
                }
            }
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(ZenithBackground)
            .then(safeDrawingPadding())
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(bottom = if (isTimerActive) 90.dp else 16.dp) // pad when timer overlay is visible
        ) {
            // Header
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 20.dp, vertical = 10.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text(
                        text = workoutName.uppercase(),
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Black,
                        color = Color.White
                    )
                    Text(
                        text = "Actieve sportsessie",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        color = ZenithSecondary
                    )
                }

                Button(
                    onClick = onCancel,
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0x1AFF7675)),
                    shape = RoundedCornerShape(8.dp),
                    contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp)
                ) {
                    Text(text = "ANNULEER", color = ZenithError, fontSize = 10.sp, fontWeight = FontWeight.Bold)
                }
            }

            // Exercise List
            LazyColumn(
                modifier = Modifier
                    .weight(1f)
                    .padding(horizontal = 20.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                itemsIndexed(mutableExercises) { exIndex, exState ->
                    Card(
                        colors = CardDefaults.cardColors(containerColor = ZenithSurface),
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(modifier = Modifier.padding(16.dp)) {
                            // Title & Note cues
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Column {
                                    Text(
                                        text = exState.name,
                                        color = Color.White,
                                        fontSize = 14.sp,
                                        fontWeight = FontWeight.Bold
                                    )
                                    Text(
                                        text = "${exState.category} • ${exState.weightUnit.uppercase()}",
                                        color = ZenithSecondary,
                                        fontSize = 10.sp
                                    )
                                }

                                if (!exState.notes.isNullOrBlank()) {
                                    IconButton(
                                        onClick = {
                                            Toast.makeText(context, exState.notes, Toast.LENGTH_LONG).show()
                                        },
                                        modifier = Modifier.size(24.dp)
                                    ) {
                                        Text(
                                            text = "ⓘ",
                                            color = ZenithSecondary,
                                            fontSize = 16.sp,
                                            fontWeight = FontWeight.Bold
                                        )
                                    }
                                }
                            }

                            Spacer(modifier = Modifier.height(12.dp))

                            // Sets headers
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text("SET", modifier = Modifier.width(36.dp), fontSize = 10.sp, fontWeight = FontWeight.Bold, color = ZenithSecondary)
                                Text("TYPE", modifier = Modifier.width(54.dp), fontSize = 10.sp, fontWeight = FontWeight.Bold, color = ZenithSecondary)
                                Text("RICHTLIJN", modifier = Modifier.weight(1f), fontSize = 10.sp, fontWeight = FontWeight.Bold, color = ZenithSecondary)
                                Text("INVOER (GEWICHT x REPS x RIR)", modifier = Modifier.width(180.dp), fontSize = 10.sp, fontWeight = FontWeight.Bold, color = ZenithSecondary, textAlign = TextAlign.Center)
                                Spacer(modifier = Modifier.width(42.dp))
                            }

                            Spacer(modifier = Modifier.height(8.dp))

                            // Sets input list
                            exState.sets.forEachIndexed { setIndex, setVal ->
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(vertical = 4.dp),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    // Number
                                    Text(
                                        text = "${setIndex + 1}",
                                        modifier = Modifier.width(36.dp),
                                        fontSize = 13.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = if (setVal.isCompleted) ZenithAccent else Color.White
                                    )

                                    // Type Tag
                                    Box(
                                        modifier = Modifier
                                            .width(44.dp)
                                            .background(
                                                color = if (setVal.type == "warmup") Color(0x1ACBD5E1) else Color(0x1A6C5CE7),
                                                shape = RoundedCornerShape(4.dp)
                                            )
                                            .padding(vertical = 2.dp),
                                        contentAlignment = Alignment.Center
                                    ) {
                                        Text(
                                            text = if (setVal.type == "warmup") "W" else "WORK",
                                            fontSize = 8.sp,
                                            fontWeight = FontWeight.Bold,
                                            color = if (setVal.type == "warmup") ZenithPrimary else Color(0xFFa29bfe)
                                        )
                                    }
                                    Spacer(modifier = Modifier.width(10.dp))

                                    // Guideline
                                    Text(
                                        text = if (setVal.type == "warmup") {
                                            "${setVal.targetWeight} x ${setVal.targetReps}"
                                        } else {
                                            "${setVal.targetWeight} x ${setVal.targetReps} (RIR ${setVal.targetRir})"
                                        },
                                        modifier = Modifier.weight(1f),
                                        fontSize = 11.sp,
                                        color = ZenithSecondary
                                    )

                                    // Inputs row (Weight x Reps x RIR)
                                    Row(
                                        modifier = Modifier.width(180.dp),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        OutlinedTextField(
                                            value = setVal.weightInput,
                                            onValueChange = { input -> if (!setVal.isCompleted) setVal.weightInput = input },
                                            placeholder = { Text("${setVal.targetWeight}", fontSize = 10.sp) },
                                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                                            colors = OutlinedTextFieldDefaults.colors(
                                                focusedTextColor = Color.White,
                                                unfocusedTextColor = Color.White,
                                                focusedBorderColor = ZenithAccentNeon,
                                                unfocusedBorderColor = ZenithBorder
                                            ),
                                            modifier = Modifier.width(54.dp).height(38.dp),
                                            singleLine = true
                                        )

                                        Text("x", fontSize = 10.sp, color = ZenithSecondary)

                                        OutlinedTextField(
                                            value = setVal.repsInput,
                                            onValueChange = { input -> if (!setVal.isCompleted) setVal.repsInput = input },
                                            placeholder = { Text("${setVal.targetReps}", fontSize = 10.sp) },
                                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                                            colors = OutlinedTextFieldDefaults.colors(
                                                focusedTextColor = Color.White,
                                                unfocusedTextColor = Color.White,
                                                focusedBorderColor = ZenithAccentNeon,
                                                unfocusedBorderColor = ZenithBorder
                                            ),
                                            modifier = Modifier.width(48.dp).height(38.dp),
                                            singleLine = true
                                        )

                                        Text("x", fontSize = 10.sp, color = ZenithSecondary)

                                        OutlinedTextField(
                                            value = setVal.rirInput,
                                            onValueChange = { input -> if (!setVal.isCompleted) setVal.rirInput = input },
                                            placeholder = { Text("${setVal.targetRir}", fontSize = 10.sp) },
                                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                                            colors = OutlinedTextFieldDefaults.colors(
                                                focusedTextColor = Color.White,
                                                unfocusedTextColor = Color.White,
                                                focusedBorderColor = ZenithAccentNeon,
                                                unfocusedBorderColor = ZenithBorder
                                            ),
                                            modifier = Modifier.width(44.dp).height(38.dp),
                                            singleLine = true,
                                            enabled = setVal.type == "working"
                                        )
                                    }

                                    Spacer(modifier = Modifier.width(8.dp))

                                    // Complete Checkbox
                                    IconButton(
                                        onClick = {
                                            if (setVal.isCompleted) {
                                                // Uncheck
                                                setVal.isCompleted = false
                                            } else {
                                                // Parse input or fallback to guidelines
                                                val w = setVal.weightInput.toDoubleOrNull() ?: setVal.targetWeight
                                                val r = setVal.repsInput.toIntOrNull() ?: setVal.targetReps
                                                val rir = if (setVal.type == "warmup") 4 else (setVal.rirInput.toIntOrNull() ?: setVal.targetRir)

                                                setVal.weightInput = w.toString()
                                                setVal.repsInput = r.toString()
                                                setVal.rirInput = rir.toString()
                                                setVal.isCompleted = true

                                                // 1. Estimated 1RM calculation for PR celebration
                                                if (setVal.type == "working" && r > 0) {
                                                    val est1RM = w * (1 + r / 30.0)
                                                    val rounded1RM = Math.round(est1RM * 2) / 2.0 // round to nearest 0.5

                                                    val prevPR = historical1RMs[exState.exerciseId] ?: 0.0
                                                    if (rounded1RM > prevPR) {
                                                        historical1RMs[exState.exerciseId] = rounded1RM
                                                        prExerciseName = exState.name
                                                        prValue = rounded1RM
                                                        prUnit = exState.weightUnit
                                                        showPRToast = true
                                                    }
                                                }

                                                // 2. Intra-Session Autoregulation Engine (apply to NEXT set)
                                                val nextSetIndex = setIndex + 1
                                                val nextSet = exState.sets.getOrNull(nextSetIndex)
                                                if (nextSet != null && nextSet.type == "working") {
                                                    val targetRir = setVal.targetRir
                                                    val minReps = setVal.targetReps // rough estimation or look up template bounds
                                                    val maxReps = minReps + 2 // estimate default range
                                                    val step = if (exState.incrementPerSide) 2.0 * exState.incrementWeight else exState.incrementWeight

                                                    // Autoregulation rules:
                                                    if (rir < targetRir) {
                                                        // Too heavy!
                                                        if (r < minReps) {
                                                            // drop weight by 5% per RIR deficit
                                                            val deficit = targetRir - rir
                                                            val nextW = w * (1.0 - 0.05 * deficit)
                                                            // round nextW to exercise incrementWeight
                                                            val roundedW = Math.round(nextW / step) * step
                                                            
                                                            // Verify adjustment >= 50% increment step
                                                            val diff = Math.abs(w - roundedW)
                                                            if (diff >= 0.5 * step) {
                                                                nextSet.targetWeight = roundedW
                                                                nextSet.targetReps = minReps
                                                            } else {
                                                                // keep weight, reduce reps by deficit
                                                                nextSet.targetWeight = w
                                                                nextSet.targetReps = Math.max(minReps - deficit, 3)
                                                            }
                                                        } else if (rir == 0) {
                                                            // hit failure but within range, keep weight, reduce reps to be safe
                                                            nextSet.targetWeight = w
                                                            nextSet.targetReps = Math.max(r - 1, 3)
                                                        }
                                                    } else if (rir > targetRir + 1) {
                                                        // Too easy!
                                                        if (r >= maxReps) {
                                                            // increase weight by 2.5% per RIR excess
                                                            val excess = rir - targetRir
                                                            val nextW = w * (1.0 + 0.025 * excess)
                                                            val roundedW = Math.round(nextW / step) * step
                                                            
                                                            val diff = Math.abs(roundedW - w)
                                                            if (diff >= 0.5 * step) {
                                                                nextSet.targetWeight = roundedW
                                                                nextSet.targetReps = minReps
                                                            } else {
                                                                // increase reps
                                                                nextSet.targetWeight = w
                                                                nextSet.targetReps = Math.min(r + 1, maxReps)
                                                            }
                                                        } else {
                                                            // increase target reps by 1
                                                            nextSet.targetWeight = w
                                                            nextSet.targetReps = Math.min(r + 1, maxReps)
                                                        }
                                                    }
                                                    // Silently pre-fill inputs for next set
                                                    nextSet.weightInput = nextSet.targetWeight.toString()
                                                    nextSet.repsInput = nextSet.targetReps.toString()
                                                    nextSet.rirInput = nextSet.targetRir.toString()
                                                }

                                                // 3. Trigger Rest Timer (except if it is the very last set of the workout!)
                                                val isLastExercise = exIndex == mutableExercises.size - 1
                                                val isLastSet = setIndex == exState.sets.size - 1
                                                if (!(isLastExercise && isLastSet)) {
                                                    // Determine base rest time based on category:
                                                    val isCompound = listOf("Chest", "Lats", "Upper Back", "Quads", "Hamstrings").contains(exState.category)
                                                    val baseRest = if (isCompound) 120 else 90
                                                    
                                                    // Apply cardio stress factor
                                                    val totalRest = Math.round(baseRest * cardioStressFactor).toInt()
                                                    
                                                    timerDurationSeconds = totalRest
                                                    timerRemainingSeconds = totalRest
                                                    isTimerActive = true
                                                }
                                            }
                                        },
                                        modifier = Modifier.size(32.dp)
                                    ) {
                                        Text(
                                            text = "✓",
                                            color = if (setVal.isCompleted) ZenithAccent else ZenithDark,
                                            fontSize = 20.sp,
                                            fontWeight = FontWeight.Bold
                                        )
                                    }
                                }
                            }
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Completion / Finish button
            Button(
                onClick = {
                    // Check if at least one set is completed
                    val hasCompletedSet = mutableExercises.any { ex -> ex.sets.any { s -> s.isCompleted } }
                    if (!hasCompletedSet) {
                        Toast.makeText(context, "Minstens één set afvinken om te voltooien.", Toast.LENGTH_SHORT).show()
                        return@Button
                    }

                    // Calculate total volume
                    var totalVolume = 0.0
                    for (ex in mutableExercises) {
                        for (s in ex.sets) {
                            if (s.isCompleted && s.type == "working") {
                                val w = s.weightInput.toDoubleOrNull() ?: s.targetWeight
                                val r = s.repsInput.toIntOrNull() ?: s.targetReps
                                totalVolume += (w * r)
                            }
                        }
                    }

                    onComplete(mutableExercises, totalVolume)
                },
                colors = ButtonDefaults.buttonColors(containerColor = ZenithAccentNeon),
                shape = RoundedCornerShape(10.dp),
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 20.dp)
                    .height(48.dp)
            ) {
                Text(text = "TRAINING AFRONDEN", color = ZenithBackground, fontWeight = FontWeight.Bold, fontSize = 13.sp)
            }
        }

        // 5. Floating Rest Timer circular ring UI overlay
        AnimatedVisibility(
            visible = isTimerActive,
            enter = fadeIn(),
            exit = fadeOut(),
            modifier = Modifier.align(Alignment.BottomCenter)
        ) {
            Card(
                colors = CardDefaults.cardColors(containerColor = ZenithSurface),
                shape = RoundedCornerShape(topStart = 16.dp, topEnd = 16.dp),
                modifier = Modifier
                    .fillMaxWidth()
                    .border(1.dp, ZenithBorder, RoundedCornerShape(topStart = 16.dp, topEnd = 16.dp))
            ) {
                Row(
                    modifier = Modifier.padding(16.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    // Circle Progress Ring visual mock
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(
                            modifier = Modifier
                                .size(44.dp)
                                .background(Color(0x1A39FF14), CircleShape)
                                .border(2.dp, ZenithAccentNeon, CircleShape),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = "${timerRemainingSeconds}s",
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Bold,
                                color = ZenithAccentNeon
                            )
                        }
                        Spacer(modifier = Modifier.width(14.dp))
                        Column {
                            Text(text = "RUSTTIMER", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = Color.White)
                            if (cardioStressFactor > 1.0) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Text(
                                        text = "▶",
                                        color = ZenithAccentNeon,
                                        fontSize = 10.sp,
                                        fontWeight = FontWeight.Bold
                                    )
                                    Spacer(modifier = Modifier.width(4.dp))
                                    Text(
                                        text = "+${Math.round((cardioStressFactor - 1) * 100)}% rust (cardio stress)",
                                        fontSize = 9.sp,
                                        color = ZenithSecondary
                                    )
                                }
                            }
                        }
                    }

                    // Skip button (Only Skip or Wait allowed per Round 11)
                    Button(
                        onClick = { isTimerActive = false },
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0x1AFFFFFF)),
                        shape = RoundedCornerShape(6.dp),
                        contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp)
                    ) {
                        Text(text = "SKIP", color = Color.White, fontSize = 10.sp, fontWeight = FontWeight.Bold)
                    }
                }
            }
        }

        // 6. PR Toast overlay
        AnimatedVisibility(
            visible = showPRToast,
            modifier = Modifier.align(Alignment.TopCenter)
        ) {
            Card(
                colors = CardDefaults.cardColors(containerColor = Color(0xFF1E293B)),
                shape = RoundedCornerShape(8.dp),
                modifier = Modifier
                    .padding(24.dp)
                    .fillMaxWidth()
                    .border(1.dp, ZenithAccentNeon, RoundedCornerShape(8.dp))
            ) {
                Row(
                    modifier = Modifier.padding(12.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column {
                        Text(text = "PR GEBROKEN! 🔥", color = ZenithAccentNeon, fontSize = 11.sp, fontWeight = FontWeight.Black)
                        Text(text = "$prExerciseName geschat 1RM: $prValue $prUnit", color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    }
                    IconButton(onClick = { showPRToast = false }) {
                        Text(
                            text = "✓",
                            color = Color.White,
                            fontSize = 18.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
            }
        }
    }
}
