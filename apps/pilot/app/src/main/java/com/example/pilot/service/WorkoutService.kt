package com.example.pilot.service

import android.annotation.SuppressLint
import android.app.*
import android.content.Context
import android.content.Intent
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Binder
import android.os.Bundle
import android.os.IBinder
import androidx.core.app.NotificationCompat
import com.example.pilot.R
import com.example.pilot.ble.BleSensorManager
import com.example.pilot.coaching.CoachingEngine
import com.example.pilot.data.PlannedWorkout
import com.example.pilot.data.WorkoutRepository
import com.example.pilot.data.WorkoutStep
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class WorkoutService : Service() {

    private val binder = WorkoutBinder()
    private val scope = CoroutineScope(Dispatchers.Main + Job())

    lateinit var coachingEngine: CoachingEngine
    lateinit var bleSensorManager: BleSensorManager
    private val repository = WorkoutRepository()
    private var locationManager: LocationManager? = null

    // Session State
    private var activeWorkout: PlannedWorkout? = null
    private var steps = emptyList<WorkoutStep>()
    
    private val _isWorkoutActive = MutableStateFlow(false)
    val isWorkoutActive: StateFlow<Boolean> = _isWorkoutActive.asStateFlow()

    private val _isPaused = MutableStateFlow(false)
    val isPaused: StateFlow<Boolean> = _isPaused.asStateFlow()

    private val _currentBlockIndex = MutableStateFlow(0)
    val currentBlockIndex: StateFlow<Int> = _currentBlockIndex.asStateFlow()

    private val _elapsedSeconds = MutableStateFlow(0)
    val elapsedSeconds: StateFlow<Int> = _elapsedSeconds.asStateFlow()

    private val _blockElapsedSeconds = MutableStateFlow(0)
    val blockElapsedSeconds: StateFlow<Int> = _blockElapsedSeconds.asStateFlow()

    private var timerJob: Job? = null
    private var lastAdaptiveCueTime = 0L

    companion object {
        private const val CHANNEL_ID = "zenith_pilot_workout"
        private const val NOTIFICATION_ID = 101
        
        var activeService: WorkoutService? = null
    }

    inner class WorkoutBinder : Binder() {
        fun getService(): WorkoutService = this@WorkoutService
    }

    override fun onBind(intent: Intent?): IBinder = binder

    override fun onCreate() {
        super.onCreate()
        activeService = this
        coachingEngine = CoachingEngine(this)
        bleSensorManager = BleSensorManager(this)
        locationManager = getSystemService(Context.LOCATION_SERVICE) as LocationManager
        createNotificationChannel()
    }

    @SuppressLint("MissingPermission")
    fun startWorkout(workout: PlannedWorkout) {
        if (_isWorkoutActive.value) return
        
        activeWorkout = workout
        steps = workout.steps
        _isWorkoutActive.value = true
        _isPaused.value = false
        _currentBlockIndex.value = 0
        _elapsedSeconds.value = 0
        _blockElapsedSeconds.value = 0

        // Start Foreground Service
        val notification = createWorkoutNotification("Opwarmen...", "00:00", 0, 0, 1)
        startForeground(NOTIFICATION_ID, notification)

        // Request GPS Updates for Auto-Pause
        try {
            locationManager?.requestLocationUpdates(
                LocationManager.GPS_PROVIDER,
                1000L,
                1f,
                locationListener
            )
        } catch (e: Exception) {
            e.printStackTrace()
        }

        // Announcement
        val typeLabel = when (workout.type) {
            "recovery" -> "actief herstel"
            "endurance" -> "aerobe duur"
            "sweetspot" -> "sweet spot interval"
            "threshold" -> "drempel"
            "vo2max" -> "V O 2 max"
            else -> "custom"
        }
        coachingEngine.speak(
            "Training gestart. ${workout.title}. Type: $typeLabel. Veel succes.",
            "SYSTEM"
        )
        if (steps.isNotEmpty()) {
            val firstBlock = steps[0]
            coachingEngine.speak(
                "Eerste blok: ${firstBlock.name}. Duur: ${firstBlock.duration / 60} minuten.",
                "COACHING"
            )
        }

        // Start Timer
        startTimer()
    }

    fun togglePause() {
        if (!_isWorkoutActive.value) return
        _isPaused.value = !_isPaused.value
        
        if (_isPaused.value) {
            coachingEngine.speak("Workout gepauzeerd.", "SYSTEM")
            timerJob?.cancel()
        } else {
            coachingEngine.speak("Workout hervat.", "SYSTEM")
            startTimer()
        }
        updateNotification()
    }

    fun stopWorkout() {
        if (!_isWorkoutActive.value) return
        
        timerJob?.cancel()
        timerJob = null
        _isWorkoutActive.value = false
        
        // Remove location listener
        locationManager?.removeUpdates(locationListener)

        coachingEngine.speak("Training beëindigd. Goed gedaan.", "SYSTEM")

        activeWorkout?.let { workout ->
            scope.launch {
                repository.markWorkoutCompleted(workout.id)
            }
        }

        stopForeground(true)
        stopSelf()
    }

    private fun startTimer() {
        timerJob?.cancel()
        timerJob = scope.launch {
            while (isActive) {
                delay(1000)
                if (!_isPaused.value) {
                    _elapsedSeconds.value += 1
                    _blockElapsedSeconds.value += 1
                    
                    checkWorkoutProgress()
                    checkAdaptiveCoaching()
                    updateNotification()
                }
            }
        }
    }

    private fun checkWorkoutProgress() {
        val currentIdx = _currentBlockIndex.value
        if (currentIdx >= steps.size) {
            stopWorkout()
            return
        }

        val currentBlock = steps[currentIdx]
        
        // 30 seconds warning
        if (currentBlock.duration - _blockElapsedSeconds.value == 30) {
            coachingEngine.speak("Nog dertig seconden.", "COACHING")
        }

        if (_blockElapsedSeconds.value >= currentBlock.duration) {
            // Move to next block
            val nextIdx = currentIdx + 1
            if (nextIdx < steps.size) {
                _currentBlockIndex.value = nextIdx
                _blockElapsedSeconds.value = 0
                val nextBlock = steps[nextIdx]
                coachingEngine.speak(
                    "Volgend blok: ${nextBlock.name}. Duur: ${nextBlock.duration / 60} minuten.",
                    "COACHING"
                )
            } else {
                stopWorkout()
            }
        }
    }

    private fun checkAdaptiveCoaching() {
        val now = System.currentTimeMillis()
        if (now - lastAdaptiveCueTime < 30_000) return // Max one adaptive cue every 30 seconds to not be annoying

        val currentIdx = _currentBlockIndex.value
        if (currentIdx >= steps.size) return
        val currentBlock = steps[currentIdx]

        val hr = bleSensorManager.currentHR.value
        val power = bleSensorManager.currentPower.value
        val ftp = activeWorkout?.ftp ?: 220
        val lthr = activeWorkout?.lthr ?: 160

        // Only run zone checks every 5 minutes (or 300s) unless it is a severe zone breach
        val isFiveMinuteCheck = (_elapsedSeconds.value > 0 && _elapsedSeconds.value % 300 == 0)

        // 1. Check Power Target if Power Meter is connected and block has target
        if (power != null && currentBlock.powerPct > 0.0) {
            val targetPower = Math.round(currentBlock.powerPct * ftp).toInt()
            val powerLowThreshold = targetPower - 25
            val powerHighThreshold = targetPower + 25

            if (power < powerLowThreshold) {
                coachingEngine.speak("Vermogen is te laag. Doel is $targetPower watt. Verhoog uw inspanning.", "PACING")
                lastAdaptiveCueTime = now
                return
            } else if (power > powerHighThreshold) {
                coachingEngine.speak("Vermogen is te hoog. Doel is $targetPower watt. Neem wat gas terug.", "PACING")
                lastAdaptiveCueTime = now
                return
            }
        }

        // 2. Check HR Target if HR is connected (only every 5 minutes to avoid heart rate drift panic)
        if (hr != null && isFiveMinuteCheck) {
            // Estimate target HR from zone
            val targetHrMax = when (currentBlock.zone) {
                1 -> Math.round(lthr * 0.68).toInt()
                2 -> Math.round(lthr * 0.83).toInt()
                3 -> Math.round(lthr * 0.94).toInt()
                4 -> Math.round(lthr * 1.05).toInt()
                else -> 200
            }

            if (hr > targetHrMax + 5) {
                coachingEngine.speak("Hartslag is ${hr}. Dit is hoog voor dit herstelblok. Kalmeer uw ademhaling.", "PACING")
                lastAdaptiveCueTime = now
            }
        }
    }

    private val locationListener = object : LocationListener {
        override fun onLocationChanged(location: Location) {
            val speedKmh = location.speed * 3.6
            if (_isWorkoutActive.value) {
                if (speedKmh < 3.0 && !_isPaused.value) {
                    // Auto-pause
                    _isPaused.value = true
                    coachingEngine.speak("Automatisch gepauzeerd.", "SYSTEM")
                    timerJob?.cancel()
                    updateNotification()
                } else if (speedKmh > 5.0 && _isPaused.value) {
                    // Auto-resume
                    _isPaused.value = false
                    coachingEngine.speak("Automatisch hervat.", "SYSTEM")
                    startTimer()
                    updateNotification()
                }
            }
        }
        override fun onStatusChanged(provider: String?, status: Int, extras: Bundle?) {}
        override fun onProviderEnabled(provider: String) {}
        override fun onProviderDisabled(provider: String) {}
    }

    private fun createNotificationChannel() {
        val channel = NotificationChannel(
            CHANNEL_ID,
            "Zenith Pilot Actieve Training",
            NotificationManager.IMPORTANCE_LOW
        ).apply {
            description = "Toont live informatie over uw actieve fietstraining."
        }
        val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        manager.createNotificationChannel(channel)
    }

    private fun updateNotification() {
        val currentIdx = _currentBlockIndex.value
        if (currentIdx >= steps.size) return
        val currentBlock = steps[currentIdx]
        
        val hr = bleSensorManager.currentHR.value ?: 0
        val power = bleSensorManager.currentPower.value ?: 0
        val zone = currentBlock.zone

        val durationRemaining = currentBlock.duration - _blockElapsedSeconds.value
        val min = durationRemaining / 60
        val sec = durationRemaining % 60
        val timerStr = String.format(Locale.getDefault(), "%02d:%02d", min, sec)

        val notification = createWorkoutNotification(
            blockName = currentBlock.name,
            timerStr = timerStr,
            hr = hr,
            power = power,
            zone = zone
        )
        val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        manager.notify(NOTIFICATION_ID, notification)
    }

    private fun createWorkoutNotification(
        blockName: String,
        timerStr: String,
        hr: Int,
        power: Int,
        zone: Int
    ): Notification {
        val intent = Intent(this, com.example.pilot.MainActivity::class.java)
        val pendingIntent = PendingIntent.getActivity(
            this, 0, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val hrStr = if (hr > 0) " • ❤️ $hr bpm" else ""
        val powerStr = if (power > 0) " • ⚡ $power W" else ""
        val contentText = "$blockName — $timerStr$hrStr$powerStr • Zone $zone"

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(if (_isPaused.value) "ZENITH PILOT • GEPAUZEERD" else "ZENITH PILOT • ACTIEF")
            .setContentText(contentText)
            .setSmallIcon(android.R.drawable.ic_media_play)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .build()
    }

    override fun onDestroy() {
        activeService = null
        timerJob?.cancel()
        coachingEngine.shutdown()
        bleSensorManager.cleanUp()
        locationManager?.removeUpdates(locationListener)
        super.onDestroy()
    }
}
