package com.example.pilot.ui.main

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.pilot.theme.PilotTheme

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MainScreen(
  onItemClick: (androidx.navigation3.runtime.NavKey) -> Unit = {},
  modifier: Modifier = Modifier
) {
  var isCoachingActive by remember { mutableStateOf(false) }
  var isSynced by remember { mutableStateOf(true) }

  val sensorList = listOf(
    SensorItem("Hartslagmeter (Garmin HRM)", "Hartslag", "Verbonden", "#4ade80"),
    SensorItem("Cadanssensor (Wahoo)", "Cadans", "Verbonden", "#4ade80"),
    SensorItem("Vermogensmeter (Rotor)", "Vermogen", "Standby", "#94a3b8")
  )

  val coachCues = listOf(
    CoachCue("14:02:15", "System", "Pilot Live v1.0.0-alpha gestart."),
    CoachCue("14:05:00", "Pacing", "Hartslag stabiel in Zone 1. Doel: warming-up."),
    CoachCue("14:10:30", "Wind", "Tegenwind gedetecteerd. Houd vermogen constant, negeer snelheid."),
    CoachCue("14:12:45", "Coaching", "Start interval 1: 5 min op LTHR drempel.")
  )

  Scaffold(
    topBar = {
      CenterAlignedTopAppBar(
        title = {
          Text(
            text = "ZENITH PILOT",
            style = LocalTextStyle.current.copy(
              fontFamily = FontFamily.SansSerif,
              fontWeight = FontWeight.Black,
              letterSpacing = 2.sp,
              fontSize = 18.sp,
              color = Color(0xFFF8FAFC)
            )
          )
        },
        colors = TopAppBarDefaults.centerAlignedTopAppBarColors(
          containerColor = Color(0xFF09090B)
        )
      )
    },
    containerColor = Color(0xFF09090B),
    modifier = modifier.fillMaxSize()
  ) { innerPadding ->
    Column(
      modifier = Modifier
        .fillMaxSize()
        .padding(innerPadding)
        .padding(horizontal = 20.dp)
        .padding(bottom = 16.dp),
      verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
      
      // 1. Sync & Connection Status Panel
      Box(
        modifier = Modifier
          .fillMaxWidth()
          .background(Color(0xFF1C1C23).copy(alpha = 0.65f), RoundedCornerShape(16.dp))
          .border(1.dp, Color(0xFFcbd5e1).copy(alpha = 0.15f), RoundedCornerShape(16.dp))
          .padding(16.dp)
      ) {
        Row(
          modifier = Modifier.fillMaxWidth(),
          horizontalArrangement = Arrangement.SpaceBetween,
          verticalAlignment = Alignment.CenterVertically
        ) {
          Column {
            Text(
              text = "Zenith Cloud Sync",
              fontSize = 12.sp,
              fontWeight = FontWeight.Bold,
              color = Color(0xFFCBD5E1)
            )
            Text(
              text = if (isSynced) "Laatste sync: Zojuist" else "Sync vereist",
              fontSize = 11.sp,
              color = Color(0xFF94A3B8)
            )
          }
          Text(
            text = if (isSynced) "SYNCHROON" else "STANDBY",
            fontSize = 9.sp,
            fontWeight = FontWeight.ExtraBold,
            color = if (isSynced) Color(0xFF4ADE80) else Color(0xFF94A3B8),
            modifier = Modifier
              .background(
                if (isSynced) Color(0xFF4ADE80).copy(alpha = 0.1f) else Color(0xFF94A3B8).copy(alpha = 0.1f),
                RoundedCornerShape(6.dp)
              )
              .border(
                1.dp,
                if (isSynced) Color(0xFF4ADE80).copy(alpha = 0.2f) else Color(0xFF94A3B8).copy(alpha = 0.2f),
                RoundedCornerShape(6.dp)
              )
              .padding(horizontal = 8.dp, vertical = 4.dp)
          )
        }
      }

      // 2. BLE Sensors Status Panel
      Column(
        modifier = Modifier
          .fillMaxWidth()
          .background(Color(0xFF1C1C23).copy(alpha = 0.65f), RoundedCornerShape(16.dp))
          .border(1.dp, Color(0xFFcbd5e1).copy(alpha = 0.15f), RoundedCornerShape(16.dp))
          .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
      ) {
        Text(
          text = "Bluetooth BLE Sensoren",
          fontSize = 13.sp,
          fontWeight = FontWeight.Bold,
          color = Color(0xFFF8FAFC)
        )
        
        sensorList.forEach { sensor ->
          Row(
            modifier = Modifier
              .fillMaxWidth()
              .background(Color(0xFF09090B).copy(alpha = 0.4f), RoundedCornerShape(8.dp))
              .border(1.dp, Color(0xFF27272A).copy(alpha = 0.5f), RoundedCornerShape(8.dp))
              .padding(12.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
          ) {
            Column {
              Text(text = sensor.name, fontSize = 11.sp, fontWeight = FontWeight.Bold, color = Color(0xFFF8FAFC))
              Text(text = sensor.type, fontSize = 9.sp, color = Color(0xFF64748B))
            }
            Text(
              text = sensor.status.uppercase(),
              fontSize = 9.sp,
              fontWeight = FontWeight.ExtraBold,
              color = Color(android.graphics.Color.parseColor(sensor.statusColor)),
              modifier = Modifier
                .background(
                  Color(android.graphics.Color.parseColor(sensor.statusColor)).copy(alpha = 0.08f),
                  RoundedCornerShape(4.dp)
                )
                .border(
                  1.dp,
                  Color(android.graphics.Color.parseColor(sensor.statusColor)).copy(alpha = 0.2f),
                  RoundedCornerShape(4.dp)
                )
                .padding(horizontal = 6.dp, vertical = 2.dp)
            )
          }
        }
      }

      // 3. Audio Coaching Log Cards
      Column(
        modifier = Modifier
          .fillMaxWidth()
          .weight(1f)
          .background(Color(0xFF1C1C23).copy(alpha = 0.65f), RoundedCornerShape(16.dp))
          .border(1.dp, Color(0xFFcbd5e1).copy(alpha = 0.15f), RoundedCornerShape(16.dp))
          .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
      ) {
        Text(
          text = "Live In-Ear Coaching Logs",
          fontSize = 13.sp,
          fontWeight = FontWeight.Bold,
          color = Color(0xFFF8FAFC)
        )
        
        LazyColumn(
          modifier = Modifier.fillMaxWidth(),
          verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
          items(coachCues) { cue ->
            Column(
              modifier = Modifier
                .fillMaxWidth()
                .background(Color(0xFF09090B).copy(alpha = 0.6f), RoundedCornerShape(8.dp))
                .border(1.dp, Color(0xFF27272A).copy(alpha = 0.4f), RoundedCornerShape(8.dp))
                .padding(10.dp)
            ) {
              Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
              ) {
                Text(
                  text = "[${cue.category.uppercase()}]",
                  fontSize = 9.sp,
                  fontWeight = FontWeight.ExtraBold,
                  color = Color(0xFFCBD5E1)
                )
                Text(
                  text = cue.time,
                  fontSize = 9.sp,
                  color = Color(0xFF64748B)
                )
              }
              Spacer(modifier = Modifier.height(4.dp))
              Text(
                text = cue.message,
                fontSize = 11.sp,
                color = Color(0xFFCBD5E1),
                lineHeight = 14.sp
              )
            }
          }
        }
      }

      // 4. Action Buttons Footer
      Button(
        onClick = { isCoachingActive = !isCoachingActive },
        shape = RoundedCornerShape(12.dp),
        colors = ButtonDefaults.buttonColors(
          containerColor = if (isCoachingActive) Color(0xFFEF4444) else Color(0xFFCBD5E1),
          contentColor = if (isCoachingActive) Color(0xFFF8FAFC) else Color(0xFF09090B)
        ),
        modifier = Modifier
          .fillMaxWidth()
          .height(50.dp)
      ) {
        Text(
          text = if (isCoachingActive) "STOP IN-EAR COACH" else "START IN-EAR COACH",
          fontSize = 13.sp,
          fontWeight = FontWeight.ExtraBold,
          letterSpacing = 1.sp
        )
      }
    }
  }
}

data class SensorItem(val name: String, val type: String, val status: String, val statusColor: String)
data class CoachCue(val time: String, val category: String, val message: String)

@Preview(showBackground = true)
@Composable
fun MainScreenPreview() {
  PilotTheme {
    MainScreen()
  }
}
