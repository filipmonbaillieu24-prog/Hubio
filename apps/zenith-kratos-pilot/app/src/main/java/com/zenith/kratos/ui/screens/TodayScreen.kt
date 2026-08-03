package com.zenith.kratos.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.zenith.kratos.data.*
import com.zenith.kratos.ui.theme.*
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.launch
import kotlinx.serialization.json.Json

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TodayScreen(
    repository: WorkoutRepository,
    onLogout: () -> Unit,
    onStartWorkout: (templateId: String?, name: String, exercises: List<ActiveExerciseState>, factor: Double) -> Unit
) {
    val scope = rememberCoroutineScope()
    val json = remember { Json { ignoreUnknownKeys = true } }

    // 1. Observe local caches
    val context = LocalContext.current
    val db = remember { AppDatabase.getDatabase(context) }
    
    val templates by db.templateDao().getAllTemplatesFlow().collectAsState(initial = emptyList())
    val exercisesCache by db.exerciseDao().getAllExercisesFlow().collectAsState(initial = emptyList())

    // 2. Fetch/Status state
    var isSyncing by remember { mutableStateOf(false) }
    var cardioFactor by remember { mutableStateOf(1.0) }
    var unsyncedCount by remember { mutableStateOf(0) }

    // Update unsynced count
    LaunchedEffect(Unit) {
        val uns = db.workoutDao().getUnsyncedWorkouts()
        unsyncedCount = uns.size
        cardioFactor = repository.calculateCardioStressFactor()
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
                .padding(20.dp)
        ) {
            // Header
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text(
                        text = "KRATOS PILOT",
                        fontSize = 22.sp,
                        fontWeight = FontWeight.Black,
                        color = Color.White
                    )
                    Text(
                        text = "Kies een routine om te starten",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        color = ZenithSecondary
                    )
                }

                Button(
                    onClick = onLogout,
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0x1AFF7675)),
                    shape = RoundedCornerShape(8.dp),
                    contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp)
                ) {
                    Text(text = "LOG OUT", color = ZenithError, fontSize = 10.sp, fontWeight = FontWeight.Bold)
                }
            }

            Spacer(modifier = Modifier.height(20.dp))

            // Sync Warning Banner
            if (unsyncedCount > 0) {
                Card(
                    colors = CardDefaults.cardColors(containerColor = Color(0x1AEF4444)),
                    shape = RoundedCornerShape(10.dp),
                    modifier = Modifier.fillMaxWidth().padding(bottom = 16.dp).border(1.dp, Color(0x33EF4444), RoundedCornerShape(10.dp))
                ) {
                    Row(
                        modifier = Modifier.padding(12.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "⚠",
                            color = ZenithError,
                            fontSize = 20.sp,
                            fontWeight = FontWeight.Bold
                        )
                        Spacer(modifier = Modifier.width(10.dp))
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = "$unsyncedCount training(en) nog niet gesynchroniseerd",
                                color = Color.White,
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }
                        Button(
                            onClick = {
                                isSyncing = true
                                scope.launch {
                                    val ok = repository.syncUnsyncedWorkouts()
                                    if (ok) {
                                        unsyncedCount = db.workoutDao().getUnsyncedWorkouts().size
                                    }
                                    isSyncing = false
                                }
                            },
                            colors = ButtonDefaults.buttonColors(containerColor = ZenithError),
                            shape = RoundedCornerShape(6.dp),
                            contentPadding = PaddingValues(horizontal = 10.dp, vertical = 4.dp),
                            enabled = !isSyncing
                        ) {
                            Text("SYNC NU", fontSize = 9.sp, fontWeight = FontWeight.Bold, color = Color.White)
                        }
                    }
                }
            }

            // PMC stress widget
            Card(
                colors = CardDefaults.cardColors(containerColor = ZenithSurface),
                shape = RoundedCornerShape(12.dp),
                modifier = Modifier.fillMaxWidth().padding(bottom = 20.dp)
            ) {
                Row(
                    modifier = Modifier.padding(16.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Box(
                        modifier = Modifier
                            .size(36.dp)
                            .background(Color(0x1A39FF14), RoundedCornerShape(18.dp)),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = "ℹ",
                            color = ZenithAccentNeon,
                            fontSize = 18.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                    Spacer(modifier = Modifier.width(12.dp))
                    Column {
                        Text(
                            text = "Cardio Herstel Status",
                            color = Color.White,
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Bold
                        )
                        Text(
                            text = if (cardioFactor > 1.0) {
                                "Hoge vermoeidheid gedetecteerd. Rusttimers met ${Math.round((cardioFactor - 1) * 100)}% verlengd."
                            } else {
                                "Herstelstatus optimaal. Standaard rusttijden actief."
                            },
                            color = ZenithSecondary,
                            fontSize = 11.sp,
                            lineHeight = 14.sp
                        )
                    }
                }
            }

            // List of Templates
            Text(
                text = "ROUTINES",
                fontSize = 11.sp,
                fontWeight = FontWeight.Black,
                color = Color.White,
                letterSpacing = 1.sp,
                modifier = Modifier.padding(bottom = 10.dp)
            )

            if (templates.isEmpty()) {
                Box(
                    modifier = Modifier.weight(1f).fillMaxWidth(),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = "Geen routines gevonden.\nMaak eerst templates aan in Kratos Desktop.",
                        color = ZenithSecondary,
                        fontSize = 12.sp,
                        textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                        lineHeight = 16.sp
                    )
                }
            } else {
                LazyColumn(
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                    modifier = Modifier.weight(1f)
                ) {
                    items(templates) { localTemp ->
                        val tempExercises = try {
                            json.decodeFromString<List<TemplateExercise>>(localTemp.exercisesJson)
                        } catch (e: Exception) {
                            emptyList()
                        }

                        Card(
                            colors = CardDefaults.cardColors(containerColor = ZenithSurface),
                            shape = RoundedCornerShape(12.dp),
                            modifier = Modifier.fillMaxWidth().clickable {
                                // 1. Map to ActiveExerciseState list
                                val active = tempExercises.mapNotNull { te ->
                                    val ex = exercisesCache.find { e -> e.id == te.exerciseId }
                                    if (ex != null) {
                                        ActiveExerciseState(
                                            exerciseId = te.exerciseId,
                                            name = ex.name,
                                            category = ex.category,
                                            weightUnit = ex.weightUnit,
                                            incrementWeight = ex.incrementWeight,
                                            incrementPerSide = ex.incrementPerSide,
                                            notes = ex.notes,
                                            sets = te.sets.map { ts ->
                                                ActiveSetState(
                                                    type = ts.type,
                                                    targetWeight = 0.0, // will fetch last weight or start 0
                                                    targetReps = ts.minReps, // default to lower range
                                                    targetRir = ts.targetRir
                                                )
                                            }.toMutableList()
                                        )
                                    } else null
                                }

                                // 2. Async load previous weights for double progression starting values
                                scope.launch {
                                    val prevWorkout = repository.getPreviousWorkoutForTemplate(localTemp.id)
                                    if (prevWorkout != null) {
                                        // For each active exercise, lookup if it was performed in prevWorkout
                                        for (ae in active) {
                                            val log = prevWorkout.sets.find { it.exerciseId == ae.exerciseId }
                                            if (log != null && log.sets.isNotEmpty()) {
                                                // Success calculation for progressive overload:
                                                // Did all working sets hit the max_reps with RIR >= target?
                                                val workingSets = log.sets.filter { it.type == "working" }
                                                val allSuccess = workingSets.isNotEmpty() && workingSets.all { s ->
                                                    // Retrieve template target reps & RIR
                                                    val tempEx = tempExercises.find { it.exerciseId == ae.exerciseId }
                                                    val maxReps = tempEx?.sets?.filter { it.type == "working" }?.firstOrNull()?.maxReps ?: 10
                                                    val targetRir = tempEx?.sets?.filter { it.type == "working" }?.firstOrNull()?.targetRir ?: 2
                                                    
                                                    s.reps >= maxReps && s.rir >= targetRir
                                                }

                                                // If successful, double progression rule:
                                                // If hit max_reps on all sets -> increase weight by incrementWeight, reset reps to minReps
                                                // Else -> keep weight, increase reps by 1
                                                for (i in ae.sets.indices) {
                                                    val setType = ae.sets[i].type
                                                    val prevSet = log.sets.getOrNull(i) ?: log.sets.last()
                                                    val tempEx = tempExercises.find { it.exerciseId == ae.exerciseId }
                                                    val minReps = tempEx?.sets?.getOrNull(i)?.minReps ?: 8
                                                    val maxReps = tempEx?.sets?.getOrNull(i)?.maxReps ?: 12

                                                    if (setType == "working") {
                                                        if (allSuccess) {
                                                            // weight + increment, reps reset to min
                                                            val step = if (ae.incrementPerSide) 2.0 * ae.incrementWeight else ae.incrementWeight
                                                            val nextW = prevSet.weight + step
                                                            ae.sets[i] = ae.sets[i].copy(targetWeight = nextW, targetReps = minReps)
                                                        } else {
                                                            // check if they logged RIR >= target and reps < maxReps
                                                            val targetRir = tempEx?.sets?.getOrNull(i)?.targetRir ?: 2
                                                            val prevSuccessful = prevSet.rir >= targetRir
                                                            if (prevSuccessful && prevSet.reps < maxReps) {
                                                                // keep weight, reps + 1
                                                                ae.sets[i] = ae.sets[i].copy(targetWeight = prevSet.weight, targetReps = prevSet.reps + 1)
                                                            } else {
                                                                // keep weight, keep reps
                                                                ae.sets[i] = ae.sets[i].copy(targetWeight = prevSet.weight, targetReps = prevSet.reps)
                                                            }
                                                        }
                                                    } else {
                                                        // Warmup just uses same weight/reps
                                                        ae.sets[i] = ae.sets[i].copy(targetWeight = prevSet.weight, targetReps = prevSet.reps)
                                                    }
                                                }
                                            } else {
                                                // No prev log, default weight to 20kg (empty bar)
                                                for (i in ae.sets.indices) {
                                                    ae.sets[i] = ae.sets[i].copy(targetWeight = 20.0)
                                                }
                                            }
                                        }
                                    } else {
                                        // Default starting weight
                                        for (ae in active) {
                                            for (i in ae.sets.indices) {
                                                ae.sets[i] = ae.sets[i].copy(targetWeight = 20.0)
                                            }
                                        }
                                    }

                                    onStartWorkout(localTemp.id, localTemp.name, active, cardioFactor)
                                }
                            }
                        ) {
                            Column(modifier = Modifier.padding(16.dp)) {
                                Text(
                                    text = localTemp.name,
                                    color = Color.White,
                                    fontSize = 15.sp,
                                    fontWeight = FontWeight.Bold
                                )
                                Spacer(modifier = Modifier.height(4.dp))
                                val names = tempExercises.mapNotNull { te -> exercisesCache.find { e -> e.id == te.exerciseId }?.name }
                                Text(
                                    text = if (names.isEmpty()) "Geen oefeningen" else names.joinToString(", "),
                                    color = ZenithSecondary,
                                    fontSize = 11.sp,
                                    maxLines = 1,
                                    overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

// Simple safeDrawingPadding mock helper since standard WindowInsets might fail on some SDKs
@Composable
fun safeDrawingPadding(): Modifier {
    return Modifier.padding(top = 28.dp, bottom = 12.dp)
}
