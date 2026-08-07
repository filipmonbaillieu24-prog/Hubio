import React, { useState, useEffect, useRef } from 'react';
import { X, Upload, AlertTriangle, CheckCircle, Settings, ChevronDown, ChevronUp, Bug, Loader } from 'lucide-react';
import './BugReportModal.css';

export interface BugReportSubmitData {
  title: string;
  description: string;
  category: string;
  problemType: string;
  severity: string;
  screenshot: File | null;
  developerToken?: string;
  developerRepo?: string;
}

interface BugReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: BugReportSubmitData) => Promise<{ success: boolean; error?: string; githubUrl?: string }>;
  prefilledCategory: string | null;
}

export const BugReportModal: React.FC<BugReportModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  prefilledCategory,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('hub');
  const [problemType, setProblemType] = useState('ui');
  const [severity, setSeverity] = useState('medium');
  
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  
  const [showSettings, setShowSettings] = useState(false);
  const [devToken, setDevToken] = useState(() => localStorage.getItem('zenith_github_token') || '');
  const [devRepo, setDevRepo] = useState(() => localStorage.getItem('zenith_github_repo') || 'filipmonbaillieu24-prog/Zenith');
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<{ success: boolean; error?: string; githubUrl?: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      // Reset form on open
      setTitle('');
      setDescription('');
      setCategory(prefilledCategory || 'hub');
      setProblemType('ui');
      setSeverity('medium');
      setScreenshot(null);
      setScreenshotPreview(null);
      setSubmitResult(null);
    }
  }, [isOpen, prefilledCategory]);

  // Handle category prefill changes
  useEffect(() => {
    if (prefilledCategory) {
      setCategory(prefilledCategory);
    }
  }, [prefilledCategory]);

  if (!isOpen) return null;

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const processFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Selecteer a.u.b. een afbeeldingsbestand (PNG, JPG, enz.)');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert('Afbeelding is te groot. Maximale grootte is 5MB.');
      return;
    }
    setScreenshot(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setScreenshotPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const handleRemoveScreenshot = () => {
    setScreenshot(null);
    setScreenshotPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSaveDevSettings = () => {
    localStorage.setItem('zenith_github_token', devToken);
    localStorage.setItem('zenith_github_repo', devRepo);
    alert('Developer instellingen opgeslagen in local storage!');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) {
      alert('Vul a.u.b. alle verplichte velden in.');
      return;
    }

    setIsSubmitting(true);
    setSubmitResult(null);

    try {
      const result = await onSubmit({
        title,
        description,
        category,
        problemType,
        severity,
        screenshot,
        developerToken: devToken || undefined,
        developerRepo: devRepo || undefined,
      });
      setSubmitResult(result);
    } catch (err: any) {
      setSubmitResult({
        success: false,
        error: err?.message || 'Er is een onbekende fout opgetreden bij het verzenden van het rapport.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bug-modal-overlay animate-fade-in" onClick={onClose}>
      <div className="bug-modal-content animate-slide-up" onClick={(e) => e.stopPropagation()}>
        
        {/* Modal Header */}
        <div className="bug-modal-header">
          <div className="bug-header-title">
            <Bug className="bug-icon-accent" size={20} />
            <h2>Bug Rapporteren</h2>
          </div>
          <button className="bug-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="bug-modal-body">
          {submitResult && submitResult.success ? (
            <div className="bug-success-state animate-fade-in">
              <CheckCircle className="bug-success-icon" size={64} />
              <h3>Bug Succesvol Gerapporteerd!</h3>
              <p>Het probleem is geregistreerd en er is een GitHub issue aangemaakt.</p>
              {submitResult.githubUrl && (
                <a 
                  href={submitResult.githubUrl} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="bug-github-link-btn"
                >
                  Bekijk op GitHub
                </a>
              )}
              <button className="bug-action-btn primary" onClick={onClose} style={{ marginTop: '20px' }}>
                Sluiten
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="bug-form">
              {submitResult && !submitResult.success && (
                <div className="bug-error-alert animate-fade-in">
                  <AlertTriangle size={18} />
                  <span>{submitResult.error}</span>
                </div>
              )}

              {/* Form Row: Category & Problem Type */}
              <div className="bug-form-row">
                <div className="bug-form-group">
                  <label htmlFor="category">Categorie/Component *</label>
                  <select 
                    id="category" 
                    value={category} 
                    onChange={(e) => setCategory(e.target.value)}
                    required
                  >
                    <option value="hub">Zenith Hub (Algemeen)</option>
                    <option value="aero">Zenith Aero (Extensie)</option>
                    <option value="vigor">Zenith Vigor (Extensie)</option>
                    <option value="kratos">Zenith Kratos (Extensie)</option>
                    <option value="fuel">Zenith Fuel (Extensie)</option>
                    <option value="mobiel">Zenith Mobiel (APK)</option>
                    <option value="other">Overig</option>
                  </select>
                </div>

                <div className="bug-form-group">
                  <label htmlFor="problemType">Type probleem *</label>
                  <select 
                    id="problemType" 
                    value={problemType} 
                    onChange={(e) => setProblemType(e.target.value)}
                    required
                  >
                    <option value="ui">UI / Visuele Bug</option>
                    <option value="functional">Functionaliteit / Crash</option>
                    <option value="performance">Prestaties / Traagheid</option>
                    <option value="sync">Data-synchronisatie</option>
                    <option value="bluetooth">Bluetooth / BLE Koppeling</option>
                    <option value="feature">Suggestie / Feature Request</option>
                    <option value="other">Overig</option>
                  </select>
                </div>
              </div>

              {/* Form Row: Severity & Title */}
              <div className="bug-form-row">
                <div className="bug-form-group severity-group">
                  <label htmlFor="severity">Urgentie *</label>
                  <div className="severity-selector">
                    {['low', 'medium', 'high', 'critical'].map((sev) => (
                      <button
                        key={sev}
                        type="button"
                        className={`severity-btn ${sev} ${severity === sev ? 'active' : ''}`}
                        onClick={() => setSeverity(sev)}
                      >
                        {sev === 'low' && 'Laag'}
                        {sev === 'medium' && 'Medium'}
                        {sev === 'high' && 'Hoog'}
                        {sev === 'critical' && 'Kritiek'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="bug-form-group">
                <label htmlFor="title">Titel / Korte omschrijving *</label>
                <input 
                  type="text" 
                  id="title" 
                  placeholder="Bijv. Bluetooth verbinding valt weg bij Vigor app"
                  value={title} 
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={100}
                  required
                />
              </div>

              <div className="bug-form-group">
                <label htmlFor="description">Gedetailleerde beschrijving *</label>
                <textarea 
                  id="description" 
                  placeholder="Beschrijf hier het probleem, de stappen om het te reproduceren en wat er zou moeten gebeuren..."
                  value={description} 
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  required
                />
              </div>

              {/* Image Upload Zone */}
              <div className="bug-form-group">
                <label>Screenshot / Foto uploaden (optioneel)</label>
                {screenshotPreview ? (
                  <div className="bug-preview-container">
                    <img src={screenshotPreview} alt="Screenshot preview" className="bug-screenshot-preview" />
                    <button type="button" className="bug-remove-img-btn" onClick={handleRemoveScreenshot}>
                      <X size={14} /> Afbeelding Verwijderen
                    </button>
                  </div>
                ) : (
                  <div 
                    className={`bug-upload-dropzone ${dragActive ? 'active' : ''}`}
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload size={24} className="bug-upload-icon" />
                    <p>Sleep een afbeelding hierheen of klik om te bladeren</p>
                    <span>Maximale grootte: 5MB (PNG, JPG, GIF)</span>
                    <input 
                      type="file" 
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      accept="image/*"
                      style={{ display: 'none' }}
                    />
                  </div>
                )}
              </div>

              {/* Developer Configuration Overrides (Collapsible) */}
              <div className="bug-dev-settings">
                <button 
                  type="button" 
                  className="bug-dev-settings-toggle"
                  onClick={() => setShowSettings(!showSettings)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Settings size={14} />
                    <span>Developer instellingen (optioneel)</span>
                  </div>
                  {showSettings ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
                
                {showSettings && (
                  <div className="bug-dev-settings-panel animate-slide-down">
                    <p className="bug-settings-help-text">
                      Hier kunt u handmatig een GitHub Personal Access Token en repo instellen om de bug naar te sturen. 
                      Indien niet ingevuld, gebruikt Zenith de backend fallback of uw `.env` config.
                    </p>
                    <div className="bug-form-group">
                      <label htmlFor="devRepo">GitHub Repository</label>
                      <input 
                        type="text" 
                        id="devRepo" 
                        value={devRepo}
                        onChange={(e) => setDevRepo(e.target.value)}
                        placeholder="gebruiker/repo"
                      />
                    </div>
                    <div className="bug-form-group">
                      <label htmlFor="devToken">GitHub Personal Access Token (PAT)</label>
                      <input 
                        type="password" 
                        id="devToken" 
                        value={devToken}
                        onChange={(e) => setDevToken(e.target.value)}
                        placeholder="ghp_..."
                      />
                    </div>
                    <button 
                      type="button" 
                      className="bug-action-btn secondary small"
                      onClick={handleSaveDevSettings}
                    >
                      Instellingen Opslaan in browser
                    </button>
                  </div>
                )}
              </div>

              {/* Modal Actions */}
              <div className="bug-modal-actions">
                <button type="button" className="bug-action-btn secondary" onClick={onClose} disabled={isSubmitting}>
                  Annuleren
                </button>
                <button type="submit" className="bug-action-btn primary" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader className="bug-spinner" size={16} />
                      Bezig met verzenden...
                    </>
                  ) : 'Verzenden naar GitHub'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
