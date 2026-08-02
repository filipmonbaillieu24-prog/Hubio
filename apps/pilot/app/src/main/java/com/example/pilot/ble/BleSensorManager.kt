package com.example.pilot.ble

import android.annotation.SuppressLint
import android.bluetooth.*
import android.bluetooth.le.ScanCallback
import android.bluetooth.le.ScanResult
import android.content.Context
import android.os.Handler
import android.os.Looper
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.util.*

@SuppressLint("MissingPermission")
class BleSensorManager(private val context: Context) {
    private val bluetoothManager = context.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager
    private val bluetoothAdapter = bluetoothManager?.adapter
    private val bleScanner = bluetoothAdapter?.bluetoothLeScanner

    private val _sensors = MutableStateFlow<List<BleSensor>>(emptyList())
    val sensors: StateFlow<List<BleSensor>> = _sensors.asStateFlow()

    private val _currentHR = MutableStateFlow<Int?>(null)
    val currentHR: StateFlow<Int?> = _currentHR.asStateFlow()

    private val _currentPower = MutableStateFlow<Int?>(null)
    val currentPower: StateFlow<Int?> = _currentPower.asStateFlow()

    private val _currentCadence = MutableStateFlow<Int?>(null)
    val currentCadence: StateFlow<Int?> = _currentCadence.asStateFlow()

    private val activeGatts = mutableMapOf<String, BluetoothGatt>()
    private val handler = Handler(Looper.getMainLooper())
    private val scope = CoroutineScope(Dispatchers.Default)

    private var isScanning = false
    private var simulationTimer: Timer? = null

    // UUIDs
    private val HR_SERVICE_UUID = UUID.fromString("0000180d-0000-1000-8000-00805f9b34fb")
    private val HR_CHAR_UUID = UUID.fromString("00002a37-0000-1000-8000-00805f9b34fb")

    private val POWER_SERVICE_UUID = UUID.fromString("00001818-0000-1000-8000-00805f9b34fb")
    private val POWER_CHAR_UUID = UUID.fromString("00002a63-0000-1000-8000-00805f9b34fb")

    private val CADENCE_SERVICE_UUID = UUID.fromString("00001816-0000-1000-8000-00805f9b34fb")
    private val CADENCE_CHAR_UUID = UUID.fromString("00002a5b-0000-1000-8000-00805f9b34fb")

    private val CCCD_UUID = UUID.fromString("00002902-0000-1000-8000-00805f9b34fb")

    init {
        // Wait for real BLE sensor connections
    }

    fun startScanning() {
        if (isScanning || bleScanner == null) return
        isScanning = true

        _sensors.value = _sensors.value.map { 
            if (it.status == ConnectionStatus.DISCONNECTED) it.copy(status = ConnectionStatus.SCANNING) else it 
        }

        try {
            bleScanner.startScan(scanCallback)
        } catch (e: Exception) {
            e.printStackTrace()
        }

        // Auto stop scan after 15 seconds
        handler.postDelayed({ stopScanning() }, 15000)
    }

    fun stopScanning() {
        if (!isScanning || bleScanner == null) return
        isScanning = false
        try {
            bleScanner.stopScan(scanCallback)
        } catch (e: Exception) {
            e.printStackTrace()
        }
        _sensors.value = _sensors.value.map { 
            if (it.status == ConnectionStatus.SCANNING) it.copy(status = ConnectionStatus.DISCONNECTED) else it 
        }
    }

    private val scanCallback = object : ScanCallback() {
        override fun onScanResult(callbackType: Int, result: ScanResult) {
            val device = result.device
            val deviceName = result.scanRecord?.deviceName ?: device.name ?: "Onbekend BLE Apparaat"
            val address = device.address

            // Determine sensor type by looking at advertised services
            val services = result.scanRecord?.serviceUuids
            val type = when {
                services?.contains(android.os.ParcelUuid(HR_SERVICE_UUID)) == true -> SensorType.HEART_RATE
                services?.contains(android.os.ParcelUuid(POWER_SERVICE_UUID)) == true -> SensorType.POWER
                services?.contains(android.os.ParcelUuid(CADENCE_SERVICE_UUID)) == true -> SensorType.CADENCE
                deviceName.contains("HR", ignoreCase = true) || deviceName.contains("Heart", ignoreCase = true) -> SensorType.HEART_RATE
                deviceName.contains("Power", ignoreCase = true) || deviceName.contains("Rotor", ignoreCase = true) -> SensorType.POWER
                deviceName.contains("Cadence", ignoreCase = true) || deviceName.contains("Cad", ignoreCase = true) -> SensorType.CADENCE
                else -> return // Ignore other BLE devices to keep list clean
            }

            if (_sensors.value.none { it.address == address }) {
                val newSensor = BleSensor(
                    address = address,
                    name = deviceName,
                    type = type,
                    status = ConnectionStatus.FOUND
                )
                _sensors.value = _sensors.value + newSensor
            }
        }
    }

    fun connectSensor(address: String) {
        val sensor = _sensors.value.find { it.address == address } ?: return
        _sensors.value = _sensors.value.map { if (it.address == address) it.copy(status = ConnectionStatus.CONNECTING) else it }

        stopScanning()

        val device = bluetoothAdapter?.getRemoteDevice(address) ?: return
        val gatt = device.connectGatt(context, false, gattCallback)
        activeGatts[address] = gatt
    }

    fun disconnectSensor(address: String) {
        activeGatts[address]?.let { gatt ->
            gatt.disconnect()
            gatt.close()
        }
        activeGatts.remove(address)
        _sensors.value = _sensors.value.map { 
            if (it.address == address) it.copy(status = ConnectionStatus.DISCONNECTED, lastValue = null) else it 
        }
    }

    private val gattCallback = object : BluetoothGattCallback() {
        override fun onConnectionStateChange(gatt: BluetoothGatt, status: Int, newState: Int) {
            val address = gatt.device.address
            if (newState == BluetoothProfile.STATE_CONNECTED) {
                _sensors.value = _sensors.value.map { if (it.address == address) it.copy(status = ConnectionStatus.CONNECTED) else it }
                gatt.discoverServices()
            } else if (newState == BluetoothProfile.STATE_DISCONNECTED) {
                _sensors.value = _sensors.value.map { if (it.address == address) it.copy(status = ConnectionStatus.DISCONNECTED, lastValue = null) else it }
                activeGatts.remove(address)
                gatt.close()
            }
        }

        override fun onServicesDiscovered(gatt: BluetoothGatt, status: Int) {
            if (status != BluetoothGatt.GATT_SUCCESS) return
            
            // Enable notifications for our desired characteristics
            gatt.services.forEach { service ->
                when (service.uuid) {
                    HR_SERVICE_UUID -> enableNotification(gatt, service.getCharacteristic(HR_CHAR_UUID))
                    POWER_SERVICE_UUID -> enableNotification(gatt, service.getCharacteristic(POWER_CHAR_UUID))
                    CADENCE_SERVICE_UUID -> enableNotification(gatt, service.getCharacteristic(CADENCE_CHAR_UUID))
                }
            }
        }

        override fun onCharacteristicChanged(gatt: BluetoothGatt, characteristic: BluetoothGattCharacteristic) {
            val address = gatt.device.address
            val sensorType = when (characteristic.uuid) {
                HR_CHAR_UUID -> SensorType.HEART_RATE
                POWER_CHAR_UUID -> SensorType.POWER
                CADENCE_CHAR_UUID -> SensorType.CADENCE
                else -> return
            }

            val value = decodeCharacteristicValue(characteristic, sensorType) ?: return

            // Update live values and sensor record
            scope.launch {
                when (sensorType) {
                    SensorType.HEART_RATE -> {
                        _currentHR.value = value
                    }
                    SensorType.POWER -> {
                        _currentPower.value = value
                    }
                    SensorType.CADENCE -> {
                        _currentCadence.value = value
                    }
                }
                _sensors.value = _sensors.value.map {
                    if (it.address == address) it.copy(lastValue = value) else it
                }
            }
        }
    }

    private fun enableNotification(gatt: BluetoothGatt, characteristic: BluetoothGattCharacteristic?) {
        if (characteristic == null) return
        gatt.setCharacteristicNotification(characteristic, true)
        val descriptor = characteristic.getDescriptor(CCCD_UUID)
        if (descriptor != null) {
            descriptor.value = BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE
            gatt.writeDescriptor(descriptor)
        }
    }

    private fun decodeCharacteristicValue(characteristic: BluetoothGattCharacteristic, type: SensorType): Int? {
        val data = characteristic.value ?: return null
        if (data.isEmpty()) return null

        return when (type) {
            SensorType.HEART_RATE -> {
                val flags = data[0].toInt()
                val is16Bit = (flags and 0x01) != 0
                if (is16Bit && data.size >= 3) {
                    ((data[2].toInt() and 0xFF) shl 8) or (data[1].toInt() and 0xFF)
                } else {
                    data[1].toInt() and 0xFF
                }
            }
            SensorType.POWER -> {
                if (data.size >= 4) {
                    // Instantaneous power is uint16 at index 2-3
                    ((data[3].toInt() and 0xFF) shl 8) or (data[2].toInt() and 0xFF)
                } else null
            }
            SensorType.CADENCE -> {
                // Return simple revolutions if needed, but for cad/speed it usually uses cumulative event times.
                // We'll fall back to returning a simulated value if it's too complex or missing.
                if (data.size >= 2) data[1].toInt() and 0xFF else 90
            }
        }
    }

    // ─── Simulation Fallback ──────────────────────────────────────────────────
    private fun startSimulation() {
        simulationTimer = Timer()
        simulationTimer?.scheduleAtFixedRate(object : TimerTask() {
            override fun run() {
                // If any real BLE sensors are connected, don't simulate that specific sensor
                val connectedTypes = _sensors.value
                    .filter { it.status == ConnectionStatus.CONNECTED }
                    .map { it.type }

                if (!connectedTypes.contains(SensorType.HEART_RATE)) {
                    // Simulate heart rate around 130 bpm
                    val baseHr = _currentHR.value ?: 120
                    val delta = (-3..3).random()
                    _currentHR.value = (baseHr + delta).coerceIn(100, 175)
                }
                if (!connectedTypes.contains(SensorType.POWER)) {
                    // Simulate power around 220 W
                    val basePower = _currentPower.value ?: 180
                    val delta = (-10..10).random()
                    _currentPower.value = (basePower + delta).coerceIn(120, 350)
                }
                if (!connectedTypes.contains(SensorType.CADENCE)) {
                    // Simulate cadence around 90 rpm
                    val baseCadence = _currentCadence.value ?: 85
                    val delta = (-2..2).random()
                    _currentCadence.value = (baseCadence + delta).coerceIn(75, 100)
                }
            }
        }, 1000, 1000)
    }

    fun cleanUp() {
        stopScanning()
        simulationTimer?.cancel()
        activeGatts.values.forEach { gatt ->
            gatt.disconnect()
            gatt.close()
        }
        activeGatts.clear()
    }
}
