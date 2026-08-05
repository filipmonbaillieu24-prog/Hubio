package com.example.pilot

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.example.pilot.ui.auth.LoginScreen
import com.example.pilot.ui.auth.LoginViewModel
import com.example.pilot.ui.main.MainScreen
import io.github.jan.supabase.auth.status.SessionStatus

@Composable
fun MainNavigation() {
  val loginViewModel: LoginViewModel = viewModel()
  val sessionStatus by loginViewModel.sessionStatus.collectAsState()

  var showLoadingTimeout by androidx.compose.runtime.remember { androidx.compose.runtime.mutableStateOf(true) }

  androidx.compose.runtime.LaunchedEffect(Unit) {
    kotlinx.coroutines.delay(2000)
    showLoadingTimeout = false
  }

  val showLoading = (sessionStatus.toString().contains("Loading") || sessionStatus.toString().contains("Initializing")) && showLoadingTimeout

  when {
    sessionStatus is SessionStatus.Authenticated -> {
      MainScreen(
        onLogout = { loginViewModel.logout() },
        modifier = Modifier.safeDrawingPadding()
      )
    }
    showLoading -> {
      Box(
        modifier = Modifier
          .fillMaxSize()
          .background(Color(0xFF09090B)),
        contentAlignment = Alignment.Center
      ) {
        CircularProgressIndicator(color = Color(0xFFCBD5E1))
      }
    }
    else -> {
      LoginScreen(viewModel = loginViewModel)
    }
  }
}
