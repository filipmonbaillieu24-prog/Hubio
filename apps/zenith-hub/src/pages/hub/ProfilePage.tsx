import React, { useEffect, useState } from 'react';
import { ChevronLeft, User, AlertCircle, Check, Sparkles } from 'lucide-react';
import { supabase } from '../../utils/supabaseClient';
import './ProfilePage.css';
import './ZenithHub.css';

interface ProfilePageProps {
  initialProfile: any;
  userId: string;
  onBack: () => void;
  onSave: (updatedProfile: any) => Promise<void>;
}

export const ProfilePage: React.FC<ProfilePageProps> = ({
  initialProfile,
  userId,
  onBack,
  onSave,
}) => {
  const [name, setName] = useState(initialProfile.name || '');
  const [gender, setGender] = useState(initialProfile.gender || '');
  const [birthDate, setBirthDate] = useState(initialProfile.birthDate || '');
  const [height, setHeight] = useState<string>(initialProfile.height?.toString() || '');
  
  const [latestWeight, setLatestWeight] = useState<number | null>(null);
  const [weightDate, setWeightDate] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Fetch the latest weight measurement from Vigor weight logs
  useEffect(() => {
    const fetchLatestWeight = async () => {
      try {
        const { data, error } = await supabase
          .from('vigor_weight')
          .select('weight, logged_at')
          .eq('user_id', userId)
          .order('logged_at', { ascending: false })
          .limit(1);

        if (error) throw error;

        if (data && data.length > 0) {
          setLatestWeight(data[0].weight);
          const dateStr = new Date(data[0].logged_at).toLocaleDateString('nl-NL', {
            day: '2-digit',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          });
          setWeightDate(dateStr);
        }
      } catch (err) {
        console.error('Kon laatste gewicht van Vigor niet ophalen:', err);
      }
    };

    fetchLatestWeight();
  }, [userId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    // Validate inputs
    if (!name.trim()) {
      setErrorMsg('Naam mag niet leeg zijn.');
      setSaving(false);
      return;
    }

    if (height && (parseFloat(height) < 50 || parseFloat(height) > 250)) {
      setErrorMsg('Voer een geldige lengte in (tussen 50 en 250 cm).');
      setSaving(false);
      return;
    }

    try {
      const updatedProfile = {
        ...initialProfile,
        name: name.trim(),
        gender: gender || undefined,
        birthDate: birthDate || undefined,
        height: height ? parseFloat(height) : undefined,
        // Persist the latest Vigor weight in metadata, or keep existing if Vigor has no entries yet
        weight: latestWeight !== null ? latestWeight : initialProfile.weight
      };

      await onSave(updatedProfile);
      setSuccessMsg('Profiel succesvol bijgewerkt!');
      
      // Auto clear success message after 3 seconds
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Fout bij het bijwerken van het profiel.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="zh-hub-container">
      {/* Background radial glow */}
      <div className="zh-hub-glow" style={{ background: 'radial-gradient(circle at 50% 30%, rgba(108, 92, 231, 0.08) 0%, transparent 60%)' }} />

      {/* Header */}
      <header className="zh-hub-header animate-slide-down">
        <button onClick={onBack} className="zh-back-btn">
          <ChevronLeft size={16} /> Terug naar Hub
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: '#64748b' }}>
          <Sparkles size={12} style={{ color: '#cbd5e1' }} />
          <span style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Persoonlijk Profiel
          </span>
        </div>
      </header>

      {/* Form Container */}
      <div className="zh-profile-grid animate-slide-up">
        <div className="zh-profile-card">
          <h2 className="zh-profile-card-title">
            <User size={16} style={{ color: '#cbd5e1' }} />
            Persoonlijke Basisgegevens
          </h2>

          {successMsg && (
            <div className="zh-notification success">
              <Check size={16} style={{ flexShrink: 0 }} />
              <span>{successMsg}</span>
            </div>
          )}

          {errorMsg && (
            <div className="zh-notification error">
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="zh-profile-form">
            {/* Naam */}
            <div className="zh-profile-row">
              <label htmlFor="profileName">Naam</label>
              <input
                id="profileName"
                type="text"
                className="zh-profile-input"
                placeholder="Je volledige naam"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            {/* Geslacht */}
            <div className="zh-profile-row">
              <label htmlFor="profileGender">Geslacht</label>
              <select
                id="profileGender"
                className="zh-profile-select"
                value={gender}
                onChange={(e) => setGender(e.target.value)}
              >
                <option value="">Niet opgegeven</option>
                <option value="male">Man</option>
                <option value="female">Vrouw</option>
                <option value="other">Anders</option>
              </select>
            </div>

            {/* Geboortedatum */}
            <div className="zh-profile-row">
              <label htmlFor="profileBirth">Geboortedatum</label>
              <input
                id="profileBirth"
                type="date"
                className="zh-profile-input"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                max={new Date().toISOString().split('T')[0]}
              />
            </div>

            {/* Lengte */}
            <div className="zh-profile-row">
              <label htmlFor="profileHeight">Lengte <span>(cm)</span></label>
              <input
                id="profileHeight"
                type="number"
                min="50"
                max="250"
                className="zh-profile-input"
                placeholder="—"
                value={height}
                onChange={(e) => setHeight(e.target.value)}
              />
            </div>

            {/* Gewicht (Read-only, linked to Vigor) */}
            <div className="zh-profile-row">
              <label>Gewicht <span>(kg)</span></label>
              <input
                type="text"
                className="zh-profile-input"
                disabled
                value={latestWeight !== null ? `${latestWeight} kg` : 'Nog geen meting'}
              />
              <p className="zh-profile-note">
                {latestWeight !== null ? (
                  <>
                    Laatst gemeten: <strong>{latestWeight} kg</strong> op {weightDate} via de Vigor-extensie.
                  </>
                ) : (
                  <>
                    Er is nog geen gewichtsmeting gevonden in de database. Log een meting via de <strong>Vigor</strong> extensie.
                  </>
                )}
              </p>
            </div>

            {/* Actions */}
            <div className="zh-profile-actions">
              <button
                type="button"
                className="zh-btn-cancel"
                onClick={onBack}
                disabled={saving}
              >
                Annuleren
              </button>
              <button
                type="submit"
                className="zh-btn-save"
                disabled={saving}
              >
                {saving ? 'Opslaan...' : 'Opslaan'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
