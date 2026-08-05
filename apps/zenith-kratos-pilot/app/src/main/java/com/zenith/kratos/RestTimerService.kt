package com.zenith.kratos

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.media.AudioManager
import android.media.ToneGenerator
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.VibrationEffect
import android.os.Vibrator
import androidx.core.app.NotificationCompat

class RestTimerService : Service() {

    companion object {
        const val CHANNEL_ID = "kratos_rest_timer"
        const val NOTIFICATION_ID = 9911
        
        const val ACTION_START = "START"
        const val ACTION_STOP = "STOP"
        const val EXTRA_DURATION = "DURATION"
        const val EXTRA_MUTED = "MUTED"
        
        var remainingSeconds = 0
            private set
        var isRunning = false
            private set
    }

    private var duration = 0
    private var isMuted = false
    private var handler: Handler? = null
    private var runnable: Runnable? = null

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val action = intent?.action
        if (action == ACTION_START) {
            duration = intent.getIntExtra(EXTRA_DURATION, 90)
            isMuted = intent.getBooleanExtra(EXTRA_MUTED, false)
            remainingSeconds = duration
            isRunning = true
            
            startForeground(NOTIFICATION_ID, buildNotification(remainingSeconds))
            startCountdown()
        } else if (action == ACTION_STOP) {
            stopTimer()
        }
        return START_NOT_STICKY
    }

    private fun startCountdown() {
        handler?.removeCallbacksAndMessages(null)
        handler = Handler(Looper.getMainLooper())
        runnable = object : Runnable {
            override fun run() {
                if (remainingSeconds > 0) {
                    remainingSeconds--
                    val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
                    notificationManager.notify(NOTIFICATION_ID, buildNotification(remainingSeconds))
                    
                    val updateIntent = Intent("com.zenith.kratos.TIMER_UPDATE")
                    updateIntent.putExtra("remaining", remainingSeconds)
                    sendBroadcast(updateIntent)
                    
                    handler?.postDelayed(this, 1000)
                } else {
                    onTimerFinished()
                }
            }
        }
        handler?.postDelayed(runnable!!, 1000)
    }

    private fun onTimerFinished() {
        isRunning = false
        remainingSeconds = 0
        
        val updateIntent = Intent("com.zenith.kratos.TIMER_FINISHED")
        sendBroadcast(updateIntent)
        
        // Vibrate and Play Sound in Background
        if (!isMuted) {
            try {
                val toneGen = ToneGenerator(AudioManager.STREAM_NOTIFICATION, 100)
                toneGen.startTone(ToneGenerator.TONE_PROP_BEEP, 150)
                Handler(Looper.getMainLooper()).postDelayed({
                    toneGen.startTone(ToneGenerator.TONE_PROP_BEEP, 150)
                }, 300)
                Handler(Looper.getMainLooper()).postDelayed({
                    toneGen.startTone(ToneGenerator.TONE_PROP_BEEP, 150)
                }, 600)
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
        
        try {
            val vibrator = getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                vibrator.vibrate(VibrationEffect.createOneShot(800, VibrationEffect.DEFAULT_AMPLITUDE))
            } else {
                @Suppress("DEPRECATION")
                vibrator.vibrate(800)
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }

        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    private fun stopTimer() {
        isRunning = false
        remainingSeconds = 0
        handler?.removeCallbacksAndMessages(null)
        
        val updateIntent = Intent("com.zenith.kratos.TIMER_STOPPED")
        sendBroadcast(updateIntent)
        
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    private fun buildNotification(seconds: Int): Notification {
        val minutes = seconds / 60
        val secs = seconds % 60
        val timeString = String.format("%02d:%02d", minutes, secs)

        val mainIntent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val mainPendingIntent = PendingIntent.getActivity(
            this, 0, mainIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val stopIntent = Intent(this, RestTimerService::class.java).apply {
            action = ACTION_STOP
        }
        val stopPendingIntent = PendingIntent.getService(
            this, 1, stopIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Kratos Rust Timer")
            .setContentText("$timeString resterend")
            .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
            .setContentIntent(mainPendingIntent)
            .setOnlyAlertOnce(true)
            .setOngoing(true)
            .addAction(android.R.drawable.ic_menu_close_clear_cancel, "Overslaan", stopPendingIntent)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val name = "Rust Timer"
            val descriptionText = "Toont de resterende rusttijd tussen sets"
            val importance = NotificationManager.IMPORTANCE_LOW
            val channel = NotificationChannel(CHANNEL_ID, name, importance).apply {
                description = descriptionText
                setShowBadge(false)
            }
            val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            notificationManager.createNotificationChannel(channel)
        }
    }

    override fun onDestroy() {
        handler?.removeCallbacksAndMessages(null)
        isRunning = false
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? {
        return null
    }
}
