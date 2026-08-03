package com.zenith.kratos.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val DarkColorScheme = darkColorScheme(
    primary = ZenithPrimary,
    secondary = ZenithSecondary,
    background = ZenithBackground,
    surface = ZenithSurface,
    onPrimary = Color(0xFF09090B),
    onSecondary = Color(0xFF09090B),
    onBackground = Color(0xFFF8FAFC),
    onSurface = Color(0xFFF8FAFC),
    error = ZenithError
)

@Composable
fun KratosPilotTheme(
    content: @Composable () -> Unit
) {
    MaterialTheme(
        colorScheme = DarkColorScheme,
        content = content
    )
}
