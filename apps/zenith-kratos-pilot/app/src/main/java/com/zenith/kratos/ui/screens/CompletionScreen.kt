package com.zenith.kratos.ui.screens

import android.widget.Toast
import androidx.compose.foundation.background
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
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.zenith.kratos.data.*
import com.zenith.kratos.ui.theme.*
import io.github.jan.supabase.postgrest.postgrest
import kotlinx.coroutines.launch
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import java.util.UUID

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CompletionScreen(
    workoutName: String,
    templateId: String?,
    startTime: String,
    completedTime: String,
    volume: Double,
    cardioStressFactor: Double,
    exercises: List<ActiveExerciseState>,
    repository: WorkoutRepository,
    onFinish: () -> Unit
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    var saveToTemplate by remember { mutableStateOf(false) }
    var isSaving by remember { mutableStateOf(false) }

    // Parse duration
    val durationMinutes = remember {
        try {
            val sdf = java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", java.util.Locale.getDefault())
            val start = sdf.parse(startTime)?.time ?: 0L
            val end = sdf.parse(completedTime)?.time ?: 0L
            Math.max(1, ((end - start) / 60000).toInt())
        } catch (e: Exception) {
            45
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
                .padding(20.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(
                text = "WORKOUT VOLTOOID! 🎉",
                fontSize = 20.sp,
                fontWeight = FontWeight.Black,
                color = ZenithAccentNeon,
                letterSpacing = 1.sp,
                modifier = Modifier.padding(top = 16.dp, bottom = 4.dp)
            )
            Text(
                text = "Gefeliciteerd met je inspanning!",
                fontSize = 11.sp,
                color = ZenithSecondary,
                modifier = Modifier.padding(bottom = 24.dp)
            )

            // Volume and duration cards row
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                Card(
                    colors = CardDefaults.cardColors(containerColor = ZenithSurface),
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.weight(1f)
                ) {
                    Column(
                        modifier = Modifier.padding(16.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Text("Volume", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = ZenithSecondary)
                        Text("$volume kg", fontSize = 18.sp, fontWeight = FontWeight.Black, color = Color.White)
                    }
                }

                Card(
                    colors = CardDefaults.cardColors(containerColor = ZenithSurface),
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.weight(1f)
                ) {
                    Column(
                        modifier = Modifier.padding(16.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Text("Duur", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = ZenithSecondary)
                        Text("$durationMinutes min", fontSize = 18.sp, fontWeight = FontWeight.Black, color = Color.White)
                    }
                }
            }

            Spacer(modifier = Modifier.height(20.dp))

            // Exercise summary list
            Card(
                colors = CardDefaults.cardColors(containerColor = ZenithSurface),
                shape = RoundedCornerShape(12.dp),
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f)
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text(
                        text = "SAMENVATTING VAN DE TRAINING",
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Black,
                        color = Color.White,
                        letterSpacing = 0.5.sp,
                        modifier = Modifier.padding(bottom = 12.dp)
                    )

                    LazyColumn(
                        verticalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        items(exercises) { ex ->
                            val workingSets = ex.sets.filter { it.isCompleted }
                            if (workingSets.isNotEmpty()) {
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Text(
                                        text = ex.name,
                                        color = Color.White,
                                        fontSize = 13.sp,
                                        fontWeight = FontWeight.Bold,
                                        modifier = Modifier.weight(1f)
                                    )

                                    val summary = workingSets.joinToString(", ") { s ->
                                        "${s.weightInput}kg x ${s.repsInput}"
                                    }
                                    Text(
                                        text = summary,
                                        color = ZenithSecondary,
                                        fontSize = 11.sp,
                                        textAlign = TextAlign.End
                                    )
                                }
                            }
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(20.dp))

            // Save to template switch (Round 11)
            if (templateId != null) {
                Card(
                    colors = CardDefaults.cardColors(containerColor = ZenithSurface),
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Row(
                        modifier = Modifier.padding(16.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = "Sla wijzigingen op in template",
                                color = Color.White,
                                fontSize = 13.sp,
                                fontWeight = FontWeight.Bold
                            )
                            Text(
                                text = "Past de routine-definitie aan met zojuist behaalde reps en gewichten.",
                                color = ZenithSecondary,
                                fontSize = 10.sp,
                                lineHeight = 13.sp
                            )
                        }
                        Switch(
                            checked = saveToTemplate,
                            onCheckedChange = { saveToTemplate = it },
                            colors = SwitchDefaults.colors(
                                checkedThumbColor = ZenithAccentNeon,
                                checkedTrackColor = Color(0x3339FF14)
                            )
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(20.dp))

            // Save button
            Button(
                onClick = {
                    isSaving = true
                    scope.launch {
                        try {
                            // 1. Build Workout Exercise Logs
                            val logs = exercises.mapNotNull { ex ->
                                val completedSets = ex.sets.filter { it.isCompleted }.map { s ->
                                    WorkoutLoggedSet(
                                        type = s.type,
                                        weight = s.weightInput.toDoubleOrNull() ?: s.targetWeight,
                                        reps = s.repsInput.toIntOrNull() ?: s.targetReps,
                                        rir = s.rirInput.toIntOrNull() ?: s.targetRir
                                    )
                                }
                                if (completedSets.isNotEmpty()) {
                                    WorkoutExerciseLog(
                                        exerciseId = ex.exerciseId,
                                        sets = completedSets
                                    )
                                } else null
                            }

                            // 2. Log workout (Room + Supabase upload)
                            val workoutId = UUID.randomUUID().toString()
                            val workoutObj = Workout(
                                id = workoutId,
                                userId = "", // will use current session uid in repo
                                templateId = templateId,
                                name = workoutName,
                                startedAt = startTime,
                                completedAt = completedTime,
                                volume = volume,
                                cardioStressFactor = cardioStressFactor,
                                sets = logs
                            )
                            repository.logWorkout(workoutObj)

                            // 3. Optional: Write changes back to template
                            if (saveToTemplate && templateId != null) {
                                val db = AppDatabase.getDatabase(context)
                                val localTemp = db.templateDao().getAllTemplates().find { it.id == templateId }
                                if (localTemp != null) {
                                    val currentEx = Json.decodeFromString<List<TemplateExercise>>(localTemp.exercisesJson)
                                    val updatedEx = currentEx.map { te ->
                                        val log = logs.find { it.exerciseId == te.exerciseId }
                                        if (log != null) {
                                            // map completed sets back to TemplateSet specs
                                            val sets = log.sets.map { s ->
                                                TemplateSet(
                                                    type = s.type,
                                                    minReps = s.reps,
                                                    maxReps = s.reps + 2, // simple default boundary range
                                                    targetRir = s.rir
                                                )
                                            }
                                            te.copy(sets = sets)
                                        } else te
                                    }

                                    // Save back local cache
                                    db.templateDao().insertTemplates(listOf(
                                        localTemp.copy(exercisesJson = Json.encodeToString(updatedEx))
                                    ))

                                    // Save back remote Supabase
                                    try {
                                        SupabaseClient.client.postgrest["kratos_templates"].update(
                                            mapOf("exercises" to updatedEx)
                                        ) {
                                            filter {
                                                eq("id", templateId)
                                            }
                                        }
                                    } catch (e: Exception) {
                                        e.printStackTrace()
                                    }
                                }
                            }

                            Toast.makeText(context, "Workout succesvol opgeslagen!", Toast.LENGTH_SHORT).show()
                            onFinish()
                        } catch (e: Exception) {
                            Toast.makeText(context, "Fout bij opslaan: ${e.localizedMessage}", Toast.LENGTH_LONG).show()
                        } finally {
                            isSaving = false
                        }
                    }
                },
                colors = ButtonDefaults.buttonColors(containerColor = ZenithAccentNeon),
                shape = RoundedCornerShape(10.dp),
                modifier = Modifier
                    .fillMaxWidth()
                    .height(48.dp),
                enabled = !isSaving
            ) {
                if (isSaving) {
                    CircularProgressIndicator(modifier = Modifier.size(20.dp), color = ZenithBackground)
                } else {
                    Text(text = "OPSLAAN EN KLAAR", color = ZenithBackground, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                }
            }
        }
    }
}
