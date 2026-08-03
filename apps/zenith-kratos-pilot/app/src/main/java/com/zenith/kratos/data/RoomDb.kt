package com.zenith.kratos.data

import android.content.Context
import androidx.room.*
import kotlinx.coroutines.flow.Flow

// 1. Entities
@Entity(tableName = "exercises")
data class LocalExercise(
    @PrimaryKey val id: String,
    val name: String,
    val category: String,
    val notes: String?,
    val incrementWeight: Double,
    val incrementPerSide: Boolean,
    val defaultRir: Int,
    val weightUnit: String
)

@Entity(tableName = "templates")
data class LocalTemplate(
    @PrimaryKey val id: String,
    val name: String,
    val exercisesJson: String // Serialized JSON string of List<TemplateExercise>
)

@Entity(tableName = "completed_workouts")
data class LocalWorkout(
    @PrimaryKey val id: String,
    val templateId: String?,
    val name: String,
    val startedAt: String,
    val completedAt: String,
    val volume: Double,
    val cardioStressFactor: Double,
    val setsJson: String, // Serialized JSON string of List<WorkoutExerciseLog>
    val isSynced: Boolean = false
)

// 2. DAOs
@Dao
interface ExerciseDao {
    @Query("SELECT * FROM exercises ORDER BY name ASC")
    fun getAllExercisesFlow(): Flow<List<LocalExercise>>

    @Query("SELECT * FROM exercises")
    suspend fun getAllExercises(): List<LocalExercise>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertExercises(exercises: List<LocalExercise>)

    @Query("DELETE FROM exercises")
    suspend fun deleteAll()
}

@Dao
interface TemplateDao {
    @Query("SELECT * FROM templates ORDER BY name ASC")
    fun getAllTemplatesFlow(): Flow<List<LocalTemplate>>

    @Query("SELECT * FROM templates")
    suspend fun getAllTemplates(): List<LocalTemplate>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertTemplates(templates: List<LocalTemplate>)

    @Query("DELETE FROM templates")
    suspend fun deleteAll()
}

@Dao
interface WorkoutDao {
    @Query("SELECT * FROM completed_workouts ORDER BY completedAt DESC")
    fun getAllWorkoutsFlow(): Flow<List<LocalWorkout>>

    @Query("SELECT * FROM completed_workouts WHERE isSynced = 0")
    suspend fun getUnsyncedWorkouts(): List<LocalWorkout>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertWorkout(workout: LocalWorkout)

    @Query("UPDATE completed_workouts SET isSynced = 1 WHERE id = :workoutId")
    suspend fun markSynced(workoutId: String)
}

// 3. Database
@Database(entities = [LocalExercise::class, LocalTemplate::class, LocalWorkout::class], version = 1, exportSchema = false)
abstract class AppDatabase : RoomDatabase() {
    abstract fun exerciseDao(): ExerciseDao
    abstract fun templateDao(): TemplateDao
    abstract fun workoutDao(): WorkoutDao

    companion object {
        @Volatile
        private var INSTANCE: AppDatabase? = null

        fun getDatabase(context: Context): AppDatabase {
            return INSTANCE ?: synchronized(this) {
                val instance = Room.databaseBuilder(
                    context.applicationContext,
                    AppDatabase::class.java,
                    "kratos_database"
                ).fallbackToDestructiveMigration().build()
                INSTANCE = instance
                instance
            }
        }
    }
}
