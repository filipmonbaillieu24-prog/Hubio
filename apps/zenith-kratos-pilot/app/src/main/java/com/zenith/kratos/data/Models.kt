package com.zenith.kratos.data

import kotlinx.serialization.Serializable
import kotlinx.serialization.SerialName

@Serializable
data class Exercise(
    val id: String,
    @SerialName("user_id") val userId: String,
    val name: String,
    val category: String,
    val notes: String? = null,
    @SerialName("increment_weight") val incrementWeight: Double = 2.5,
    @SerialName("increment_per_side") val incrementPerSide: Boolean = false,
    @SerialName("default_rir") val defaultRir: Int = 2,
    @SerialName("weight_unit") val weightUnit: String = "kg",
    val deleted: Boolean = false
)

@Serializable
data class TemplateSet(
    val type: String, // warmup, working
    @SerialName("min_reps") val minReps: Int,
    @SerialName("max_reps") val maxReps: Int,
    @SerialName("target_rir") val targetRir: Int
)

@Serializable
data class TemplateExercise(
    @SerialName("exercise_id") val exerciseId: String,
    val sets: List<TemplateSet>
)

@Serializable
data class Template(
    val id: String,
    @SerialName("user_id") val userId: String,
    val name: String,
    val exercises: List<TemplateExercise>
)

@Serializable
data class WorkoutLoggedSet(
    val type: String, // warmup, working
    val weight: Double,
    val reps: Int,
    val rir: Int,
    @SerialName("rest_seconds") val restSeconds: Int? = null
)

@Serializable
data class WorkoutExerciseLog(
    @SerialName("exercise_id") val exerciseId: String,
    val sets: List<WorkoutLoggedSet>
)

@Serializable
data class Workout(
    val id: String,
    @SerialName("user_id") val userId: String,
    @SerialName("template_id") val templateId: String? = null,
    val name: String,
    @SerialName("started_at") val startedAt: String,
    @SerialName("completed_at") val completedAt: String,
    val volume: Double,
    @SerialName("cardio_stress_factor") val cardioStressFactor: Double = 1.0,
    val sets: List<WorkoutExerciseLog>
)

// Simple helper class to represent active workout UI state
data class ActiveSetState(
    var type: String, // warmup, working
    var targetWeight: Double,
    var targetReps: Int,
    var targetRir: Int,
    var weightInput: String = "",
    var repsInput: String = "",
    var rirInput: String = "",
    var isCompleted: Boolean = false,
    var isNewPR: Boolean = false
)

data class ActiveExerciseState(
    val exerciseId: String,
    val name: String,
    val category: String,
    val weightUnit: String,
    val incrementWeight: Double,
    val incrementPerSide: Boolean,
    val notes: String?,
    val sets: MutableList<ActiveSetState>
)
