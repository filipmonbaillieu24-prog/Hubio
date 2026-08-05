package com.example.pilot.data

import kotlinx.serialization.Serializable
import kotlinx.serialization.SerialName

@Serializable
data class WorkoutStep(
    val name: String = "Blok",
    val duration: Int, // in seconds
    val powerPct: Double,
    val zone: Int,
    val color: String
)

@Serializable
data class PlannedWorkout(
    val id: String,
    val date: String, // YYYY-MM-DD
    val title: String,
    val type: String, // recovery, endurance, sweetspot, threshold, vo2max
    @SerialName("duration_minutes") val durationMinutes: Int,
    @SerialName("planned_tss") val plannedTSS: Int,
    val notes: String? = null,
    val steps: List<WorkoutStep> = emptyList(),
    @SerialName("route_id") val routeId: String? = null,
    val ftp: Int? = null,
    val lthr: Int? = null,
    @SerialName("completed_at") val completedAt: String? = null
)

@Serializable
data class RoutePoint(
    val lat: Double,
    val lng: Double,
    val ele: Double,
    val distance: Double
)

@Serializable
data class Route(
    val id: String,
    val name: String,
    val distance: Double,
    val duration: Double,
    @SerialName("elev_gain") val elevGain: Double,
    val points: List<RoutePoint> = emptyList()
)
