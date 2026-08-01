package com.example.pilot.coaching

import android.content.Context
import android.speech.tts.TextToSpeech
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import java.text.SimpleDateFormat
import java.util.*

class CoachingEngine(private val context: Context) : TextToSpeech.OnInitListener {
    private var tts: TextToSpeech? = null
    private var isInitialized = false

    private val _cues = MutableStateFlow<List<CoachingCue>>(emptyList())
    val cues: StateFlow<List<CoachingCue>> = _cues.asStateFlow()

    init {
        tts = TextToSpeech(context, this)
        // Add startup cue
        postCue("SYSTEM", "Zenith Pilot Live gestart. Wachten op training...")
    }

    override fun onInit(status: Int) {
        if (status == TextToSpeech.SUCCESS) {
            val result = tts?.setLanguage(Locale("nl", "BE"))
            if (result == TextToSpeech.LANG_MISSING_DATA || result == TextToSpeech.LANG_NOT_SUPPORTED) {
                // Fallback to standard Dutch
                tts?.setLanguage(Locale("nl", "NL"))
            }
            isInitialized = true
            speak("Zenith Pilot coaching systeem is online.", "SYSTEM")
        }
    }

    fun speak(text: String, category: String) {
        postCue(category, text)
        if (isInitialized) {
            tts?.speak(text, TextToSpeech.QUEUE_FLUSH, null, "coaching_cue_${System.currentTimeMillis()}")
        }
    }

    private fun postCue(category: String, message: String) {
        val sdf = SimpleDateFormat("HH:mm:ss", Locale.getDefault())
        val timeStr = sdf.format(Date())
        val newCue = CoachingCue(timeStr, category, message)
        _cues.value = listOf(newCue) + _cues.value
    }

    fun shutdown() {
        tts?.stop()
        tts?.shutdown()
    }
}
