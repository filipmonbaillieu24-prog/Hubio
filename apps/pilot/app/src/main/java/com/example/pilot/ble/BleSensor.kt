package com.example.pilot.ble

enum class SensorType {
    HEART_RATE,
    POWER,
    CADENCE
}

enum class ConnectionStatus {
    SCANNING,
    FOUND,
    CONNECTING,
    CONNECTED,
    DISCONNECTED
}

data class BleSensor(
    val address: String,
    val name: String,
    val type: SensorType,
    val status: ConnectionStatus,
    val lastValue: Int? = null
)
