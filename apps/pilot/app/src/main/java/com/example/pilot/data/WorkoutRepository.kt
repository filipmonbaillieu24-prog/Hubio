package com.example.pilot.data

import io.github.jan.supabase.postgrest.postgrest
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class WorkoutRepository {
    private val client = SupabaseClient.client

    private fun getTodayDateString(): String {
        val sdf = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault())
        return sdf.format(Date())
    }

    fun getTodaysWorkouts(): Flow<List<PlannedWorkout>> = flow {
        while (true) {
            try {
                val todayStr = getTodayDateString()
                val response = client.postgrest["planned_workouts"].select {
                    filter {
                        eq("date", todayStr)
                        eq("completed_at", "null")
                    }
                }
                val list = response.decodeList<PlannedWorkout>()
                emit(list)
            } catch (e: Exception) {
                // If it fails or returns empty, try fetching without the null filter or handle error
                try {
                    val todayStr = getTodayDateString()
                    val response = client.postgrest["planned_workouts"].select {
                        filter {
                            eq("date", todayStr)
                        }
                    }
                    val list = response.decodeList<PlannedWorkout>().filter { it.completedAt == null }
                    emit(list)
                } catch (ex: Exception) {
                    ex.printStackTrace()
                    emit(emptyList())
                }
            }
            delay(60_000) // Poll every 60 seconds
        }
    }

    suspend fun getRoute(routeId: String): Route? {
        return try {
            val response = client.postgrest["routes"].select {
                filter {
                    eq("id", routeId)
                }
            }
            response.decodeList<Route>().firstOrNull()
        } catch (e: Exception) {
            e.printStackTrace()
            null
        }
    }

    suspend fun markWorkoutCompleted(workoutId: String) {
        try {
            val nowIso = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.getDefault()).format(Date())
            client.postgrest["planned_workouts"].update({
                set("completed_at", nowIso)
            }) {
                filter {
                    eq("id", workoutId)
                }
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }
}
