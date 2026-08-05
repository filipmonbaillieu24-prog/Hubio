package com.zenith.kratos.data

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.double

object KratosAutoregModel {
    private var W1: List<List<Double>> = emptyList()
    private var B1: List<Double> = emptyList()
    private var W2: List<List<Double>> = emptyList()
    private var B2: List<Double> = emptyList()

    fun isLoaded(): Boolean {
        return W1.isNotEmpty() && B1.isNotEmpty() && W2.isNotEmpty() && B2.isNotEmpty()
    }

    fun loadWeightsFromJson(jsonStr: String) {
        try {
            val parser = Json { ignoreUnknownKeys = true }
            val root = parser.parseToJsonElement(jsonStr)
            val array = root.jsonArray
            if (array.isNotEmpty()) {
                val weightsObj = array[0].jsonObject["weights"]?.jsonObject ?: return
                
                // Parse W1
                W1 = weightsObj["W1"]?.jsonArray?.map { row ->
                    row.jsonArray.map { it.jsonPrimitive.double }
                } ?: emptyList()
                
                // Parse B1
                B1 = weightsObj["B1"]?.jsonArray?.map { it.jsonPrimitive.double } ?: emptyList()
                
                // Parse W2
                W2 = weightsObj["W2"]?.jsonArray?.map { row ->
                    row.jsonArray.map { it.jsonPrimitive.double }
                } ?: emptyList()
                
                // Parse B2
                B2 = weightsObj["B2"]?.jsonArray?.map { it.jsonPrimitive.double } ?: emptyList()
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    fun predict(x: DoubleArray): Double {
        if (!isLoaded()) {
            return 0.5 // default fallback
        }

        val h = DoubleArray(B1.size)
        for (col in B1.indices) {
            var sum = 0.0
            for (row in x.indices) {
                sum += x[row] * W1[row][col]
            }
            h[col] = Math.max(0.0, sum + B1[col]) // ReLU
        }

        var sumOut = 0.0
        for (row in h.indices) {
            sumOut += h[row] * W2[row][0]
        }
        val y = 1.0 / (1.0 + Math.exp(-(sumOut + B2[0]))) // Sigmoid
        return y
    }

    fun predictWeight(
        setIndex: Int,
        prevWeight: Double,
        prevReps: Int,
        prevRir: Int,
        restSeconds: Int,
        targetReps: Int,
        targetRir: Int
    ): Double {
        val x = doubleArrayOf(
            Math.min(1.0, setIndex / 5.0),
            Math.min(1.5, prevWeight / 200.0),
            Math.min(1.5, prevReps / 20.0),
            Math.min(1.0, prevRir / 10.0),
            Math.min(1.5, restSeconds / 300.0)
        )

        val y = predict(x)
        val predictedE1RM = y * 200.0
        val repsToFailure = targetReps + targetRir
        val predictedWeight = predictedE1RM / (1.0 + repsToFailure / 30.0)
        return Math.max(0.0, predictedWeight)
    }
}
