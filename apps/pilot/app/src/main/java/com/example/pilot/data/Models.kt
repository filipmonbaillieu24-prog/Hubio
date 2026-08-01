package com.example.pilot.data

import kotlinx.serialization.Serializable

@Serializable
data class WorkoutStep(
    val name: String,
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
    val durationMinutes: Int,
    val plannedTSS: Int,
    val notes: String? = null,
    val steps: List<WorkoutStep> = emptyList(),
    val routeId: String? = null,
    val ftp: Int? = null,
    val lthr: Int? = null,
    val completedAt: String? = null
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
    val elevGain: Double,
    val points: List<RoutePoint> = emptyList()
)
