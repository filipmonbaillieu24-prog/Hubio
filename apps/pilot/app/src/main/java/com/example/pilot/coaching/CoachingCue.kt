package com.example.pilot.coaching

data class CoachingCue(
    val timestamp: String,
    val category: String, // PACING, COACHING, SYSTEM, WIND
    val message: String
)
