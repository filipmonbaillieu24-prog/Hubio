export interface ZaneProfile {
  height?: number; // in cm
  gender?: string; // male, female, other
  birthDate?: string; // YYYY-MM-DD
  targetWeight?: number; // in kg
  targetRateKgPerWeek?: number; // default 0.5
  dietType?: string; // balanced, high-carb, low-carb
  todayTrainingType?: 'intense' | 'endurance' | 'rest' | null;
}

export interface DailyLogData {
  date: string; // YYYY-MM-DD
  weight: number | null;
  calories: number;
  activeCalories: number;
  sleepQuality: number | null;
  sleepDurationHours: number | null;
  isComplete: boolean;
}

export interface ZaneOutput {
  bmrOffset: number;
  sleepQualityCoeff: number;
  sleepDurationCoeff: number;
  calculatedAt: string;
  isCalibrated: boolean;
  calibrationDays: number;
  dailyCalorieTarget: number;
  dailyCarbTarget: number;
  dailyProteinTarget: number;
  dailyFatTarget: number;
}

/**
 * Calculates Mifflin-St Jeor BMR for a user.
 */
export function calculateMifflinBmr(weightKg: number, heightCm: number, ageYears: number, gender: string = ''): number {
  const genderTerm = gender === 'male' ? 5 : gender === 'female' ? -161 : -78;
  return 10 * weightKg + 6.25 * heightCm - 5 * ageYears + genderTerm;
}

/**
 * Calculates the age of a user given their birthdate string.
 */
export function calculateAge(birthDateStr?: string): number {
  if (!birthDateStr) return 35; // Default age fallback
  const birthDate = new Date(birthDateStr);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

/**
 * ZANE Core Engine.
 * Implements linear interpolation for weight, screens out incomplete days,
 * and performs local multivariable ridge regression to learn metabolic & sleep coefficients.
 */
export function runZaneCalibration(
  logs: DailyLogData[],
  profile: ZaneProfile,
  latestWeightMeasured: number | null
): ZaneOutput {
  // Sort logs chronologically
  const sortedLogs = [...logs].sort((a, b) => a.date.localeCompare(b.date));

  // 1. Linearly interpolate missing weights
  const weightsWithInterpolation = interpolateWeights(sortedLogs, latestWeightMeasured);
  
  // Create a mapped list with interpolated weights
  const logsWithWeight = sortedLogs.map((log, idx) => ({
    ...log,
    weight: weightsWithInterpolation[idx]
  }));

  // 2. Identify complete days
  // A day is complete if isComplete is true and calories >= 1000.
  const completeLogs = logsWithWeight.filter(log => log.isComplete && log.calories >= 1000 && log.weight !== null);
  const calibrationDays = completeLogs.length;
  const isCalibrated = calibrationDays >= 14;

  let bmrOffset = 0;
  let sleepQualityCoeff = 0;
  let sleepDurationCoeff = 0;

  // Mifflin-St Jeor params
  const currentWeight = latestWeightMeasured || (logsWithWeight[logsWithWeight.length - 1]?.weight ?? 75);
  const height = profile.height || 175;
  const age = calculateAge(profile.birthDate);
  const gender = profile.gender || 'other';

  const baselineBmr = calculateMifflinBmr(currentWeight, height, age, gender);
  const palFactor = 1.25; // PAL baseline (Sedentary / Light activity)
  
  // Default values when not calibrated
  if (!isCalibrated) {
    // Return standard baseline targets
    const defaultTdee = baselineBmr * palFactor;
    return generateTargets(defaultTdee, currentWeight, profile, bmrOffset, sleepQualityCoeff, sleepDurationCoeff, calibrationDays, isCalibrated);
  }

  // 3. Multivariable Ridge Regression Solver
  // We want to solve for Y = X * theta
  // Where day t provides a row equation if day t is complete and day t-1 has weight:
  // Y_t = 7700 * (Weight_t - Weight_t-1) - (CalorieIntake_t - BaseTDEE_t)
  // X_t = [-1, -(SleepQuality_t - SleepQuality_avg), -(SleepDuration_t - SleepDuration_avg)]
  // theta = [bmr_offset, sleep_quality_coeff, sleep_duration_coeff]
  
  // Calculate averages for sleep
  const validSleepQualityLogs = completeLogs.filter(l => l.sleepQuality !== null);
  const sleepQualityAvg = validSleepQualityLogs.length > 0 
    ? validSleepQualityLogs.reduce((sum, l) => sum + (l.sleepQuality ?? 0), 0) / validSleepQualityLogs.length 
    : 75;

  const validSleepDurationLogs = completeLogs.filter(l => l.sleepDurationHours !== null);
  const sleepDurationAvg = validSleepDurationLogs.length > 0 
    ? validSleepDurationLogs.reduce((sum, l) => sum + (l.sleepDurationHours ?? 0), 0) / validSleepDurationLogs.length 
    : 8;

  const X: number[][] = [];
  const Y: number[] = [];

  for (let i = 1; i < logsWithWeight.length; i++) {
    const todayLog = logsWithWeight[i];
    const yesterdayLog = logsWithWeight[i - 1];

    // Verify today's log is complete, yesterday has weight, and today has weight
    if (todayLog.isComplete && todayLog.calories >= 1000 && todayLog.weight !== null && yesterdayLog.weight !== null) {
      const weightDiff = todayLog.weight - yesterdayLog.weight;
      
      const todayBaselineBmr = calculateMifflinBmr(todayLog.weight, height, age, gender);
      const todayBaseTdee = todayBaselineBmr * palFactor + todayLog.activeCalories;

      // Y value: actual weight change energy equivalent - baseline intake surplus
      const yVal = (weightDiff * 7700) - (todayLog.calories - todayBaseTdee);

      const qVal = todayLog.sleepQuality !== null ? todayLog.sleepQuality : sleepQualityAvg;
      const dVal = todayLog.sleepDurationHours !== null ? todayLog.sleepDurationHours : sleepDurationAvg;

      const x0 = -1;
      const x1 = -(qVal - sleepQualityAvg);
      const x2 = -(dVal - sleepDurationAvg);

      X.push([x0, x1, x2]);
      Y.push(yVal);
    }
  }

  if (X.length >= 14) {
    // Solve Ridge Regression (X^T * X + lambda * I)^-1 * X^T * Y
    const lambda = 1.0; // Ridge regularization factor
    const coefficients = solveRidgeRegression(X, Y, lambda);
    bmrOffset = coefficients[0];
    sleepQualityCoeff = coefficients[1];
    sleepDurationCoeff = coefficients[2];
  }

  // 4. Calculate today's dynamic calorie target
  // Pull today's sleep metrics (if logged, otherwise fallback to average)
  const todayLog = logsWithWeight[logsWithWeight.length - 1];
  const todaySleepQuality = todayLog?.sleepQuality !== null ? todayLog.sleepQuality : sleepQualityAvg;
  const todaySleepDuration = todayLog?.sleepDurationHours !== null ? todayLog.sleepDurationHours : sleepDurationAvg;
  
  const todayActiveCalories = todayLog?.activeCalories ?? 0;

  // Baseline BMR * PAL
  const todayBmr = calculateMifflinBmr(currentWeight, height, age, gender);
  let todayTdee = todayBmr * palFactor + todayActiveCalories + bmrOffset;

  // Add sleep modifications
  if (isCalibrated) {
    const sleepQualityDiff = (todaySleepQuality ?? sleepQualityAvg) - sleepQualityAvg;
    const sleepDurationDiff = (todaySleepDuration ?? sleepDurationAvg) - sleepDurationAvg;
    todayTdee += (sleepQualityCoeff * sleepQualityDiff) + (sleepDurationCoeff * sleepDurationDiff);
  } else {
    // Fallback prior adjustments
    if (todaySleepQuality !== null && todaySleepQuality < 60) {
      todayTdee *= 0.95; // 5% penalty
    }
    if (todaySleepDuration !== null && todaySleepDuration < 6.5) {
      todayTdee *= 0.95; // 5% penalty
    }
  }

  return generateTargets(todayTdee, currentWeight, profile, bmrOffset, sleepQualityCoeff, sleepDurationCoeff, calibrationDays, isCalibrated);
}

/**
 * Performs linear interpolation for missing weight values.
 */
function interpolateWeights(logs: DailyLogData[], latestWeight: number | null): (number | null)[] {
  const weights = logs.map(l => l.weight);
  
  // Find first non-null weight index
  let firstIdx = weights.findIndex(w => w !== null);
  if (firstIdx === -1) {
    // If no weight logged in the array, use the latest weight or default to null
    return weights.map(() => latestWeight);
  }

  // Fill in any leading nulls with the first known weight
  for (let i = 0; i < firstIdx; i++) {
    weights[i] = weights[firstIdx];
  }

  // Interpolate gaps
  let i = firstIdx;
  while (i < weights.length) {
    if (weights[i] === null) {
      // Find next non-null index
      let nextIdx = -1;
      for (let j = i + 1; j < weights.length; j++) {
        if (weights[j] !== null) {
          nextIdx = j;
          break;
        }
      }

      if (nextIdx !== -1) {
        // Interpolate between i-1 and nextIdx
        const wStart = weights[i - 1]!;
        const wEnd = weights[nextIdx]!;
        const steps = nextIdx - (i - 1);
        const stepVal = (wEnd - wStart) / steps;
        
        for (let k = i; k < nextIdx; k++) {
          weights[k] = wStart + stepVal * (k - (i - 1));
        }
        i = nextIdx + 1;
      } else {
        // No subsequent weights, fill the rest with the last known weight
        const lastWeight = weights[i - 1]!;
        for (let k = i; k < weights.length; k++) {
          weights[k] = lastWeight;
        }
        break;
      }
    } else {
      i++;
    }
  }

  return weights;
}

/**
 * Solves OLS regression with Ridge regularization (X^T * X + lambda * I)^-1 * X^T * Y
 * for a 3-parameter model.
 */
function solveRidgeRegression(X: number[][], Y: number[], lambda: number): number[] {
  const N = X.length;
  // Initialize X^T * X (3x3 matrix)
  const XtX = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0]
  ];
  
  // Initialize X^T * Y (3x1 vector)
  const XtY = [0, 0, 0];

  // Compute X^T * X and X^T * Y
  for (let i = 0; i < N; i++) {
    const x = X[i];
    const y = Y[i];
    
    for (let r = 0; r < 3; r++) {
      XtY[r] += x[r] * y;
      for (let c = 0; c < 3; c++) {
        XtX[r][c] += x[r] * x[c];
      }
    }
  }

  // Add Ridge Regularization lambda to the diagonal
  for (let r = 0; r < 3; r++) {
    XtX[r][r] += lambda;
  }

  // Invert 3x3 matrix XtX using analytical inverse formula
  const invXtX = invert3x3(XtX);
  if (!invXtX) {
    // If matrix is singular, return default zeros
    return [0, 0, 0];
  }

  // Multiply invXtX (3x3) * XtY (3x1) to get coefficients
  const coeff = [0, 0, 0];
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      coeff[r] += invXtX[r][c] * XtY[c];
    }
  }

  return coeff;
}

/**
 * Computes the inverse of a 3x3 matrix using the determinant and cofactor method.
 */
function invert3x3(A: number[][]): number[][] | null {
  const det =
    A[0][0] * (A[1][1] * A[2][2] - A[1][2] * A[2][1]) -
    A[0][1] * (A[1][0] * A[2][2] - A[1][2] * A[2][0]) +
    A[0][2] * (A[1][0] * A[2][1] - A[1][1] * A[2][0]);

  if (Math.abs(det) < 1e-8) {
    return null; // Singular matrix
  }

  const invDet = 1.0 / det;
  const inv = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0]
  ];

  inv[0][0] = (A[1][1] * A[2][2] - A[1][2] * A[2][1]) * invDet;
  inv[0][1] = (A[0][2] * A[2][1] - A[0][1] * A[2][2]) * invDet;
  inv[0][2] = (A[0][1] * A[1][2] - A[0][2] * A[1][1]) * invDet;

  inv[1][0] = (A[1][2] * A[2][0] - A[1][0] * A[2][2]) * invDet;
  inv[1][1] = (A[0][0] * A[2][2] - A[0][2] * A[2][0]) * invDet;
  inv[1][2] = (A[0][2] * A[1][0] - A[0][0] * A[1][2]) * invDet;

  inv[2][0] = (A[1][0] * A[2][1] - A[1][1] * A[2][0]) * invDet;
  inv[2][1] = (A[0][1] * A[2][0] - A[0][0] * A[2][1]) * invDet;
  inv[2][2] = (A[0][0] * A[1][1] - A[0][1] * A[1][0]) * invDet;

  return inv;
}

/**
 * Generates nutritional macro targets based on TDEE, weight, and user profile parameters.
 */
function generateTargets(
  tdee: number,
  weight: number,
  profile: ZaneProfile,
  bmrOffset: number,
  sleepQualityCoeff: number,
  sleepDurationCoeff: number,
  calibrationDays: number,
  isCalibrated: boolean
): ZaneOutput {
  // Apply calorie surplus or deficit to reach target weight
  let dailyCalorieTarget = tdee;
  const targetWeight = profile.targetWeight;
  const targetRate = profile.targetRateKgPerWeek ?? 0.5;

  if (targetWeight) {
    const weightMargin = 0.2; // 200 grams margin
    const diff = currentWeightDiff(weight, targetWeight);
    
    if (diff > weightMargin) {
      // Lose weight: deficit (each kg is 7700 kcal, so 0.5kg/week = 3850 kcal/week = 550 kcal/day deficit)
      const deficit = (targetRate * 7700) / 7;
      dailyCalorieTarget = Math.max(1200, tdee - deficit); // Ensure minimum 1200 kcal/day safety limit
    } else if (diff < -weightMargin) {
      // Gain weight: surplus
      const surplus = (targetRate * 7700) / 7;
      dailyCalorieTarget = tdee + surplus;
    }
  }

  dailyCalorieTarget = Math.round(dailyCalorieTarget);

  // Macro target calculations
  // Balanced: 50% Carbs, 20% Protein, 30% Fat
  // High-carb: 60% Carbs, 15% Protein, 25% Fat
  // Low-carb: 30% Carbs, 25% Protein, 45% Fat
  const diet = profile.dietType || 'balanced';
  let carbPct = 0.50;
  let proteinPct = 0.20;
  let fatPct = 0.30;

  if (diet === 'high-carb') {
    carbPct = 0.60;
    proteinPct = 0.15;
    fatPct = 0.25;
  } else if (diet === 'low-carb') {
    carbPct = 0.30;
    proteinPct = 0.25;
    fatPct = 0.45;
  }

  // CR7: Ride Labels -> Fuel Macro Timing
  const todayTrainingType = profile.todayTrainingType; // 'intense' | 'endurance' | 'rest' | null
  if (todayTrainingType === 'intense') {
    carbPct += 0.08;
    fatPct -= 0.08;
  } else if (todayTrainingType === 'rest') {
    carbPct -= 0.05;
    fatPct += 0.05;
  }

  // Convert percentages to grams
  // Carbs: 4 kcal/g
  // Protein: 4 kcal/g
  // Fat: 9 kcal/g
  const dailyCarbTarget = Math.round((dailyCalorieTarget * carbPct) / 4);
  const dailyProteinTarget = Math.round((dailyCalorieTarget * proteinPct) / 4);
  const dailyFatTarget = Math.round((dailyCalorieTarget * fatPct) / 9);

  return {
    bmrOffset: Math.round(bmrOffset),
    sleepQualityCoeff: Math.round(sleepQualityCoeff * 10) / 10,
    sleepDurationCoeff: Math.round(sleepDurationCoeff * 10) / 10,
    calculatedAt: new Date().toISOString(),
    isCalibrated,
    calibrationDays,
    dailyCalorieTarget,
    dailyCarbTarget,
    dailyProteinTarget,
    dailyFatTarget
  };
}

function currentWeightDiff(current: number, target: number): number {
  return current - target;
}

export async function saveZaneCoefficients(
  supabase: any,
  userId: string,
  bmrOffset: number,
  sleepQualityCoeff: number,
  sleepDurationCoeff: number
): Promise<void> {
  await supabase.from('ml_weights').upsert({
    user_id: userId,
    model_name: 'zane_metabolic_coefficients',
    weights: { bmrOffset, sleepQualityCoeff, sleepDurationCoeff },
    updated_at: new Date().toISOString()
  }, { onConflict: 'user_id,model_name' });
}

export async function loadZaneCoefficients(
  supabase: any,
  userId: string
): Promise<{ bmrOffset: number; sleepQualityCoeff: number; sleepDurationCoeff: number } | null> {
  const { data } = await supabase.from('ml_weights')
    .select('weights')
    .eq('user_id', userId)
    .eq('model_name', 'zane_metabolic_coefficients')
    .maybeSingle();
  return data?.weights ?? null;
}
