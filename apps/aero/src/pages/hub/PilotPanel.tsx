import React from 'react';
import { ChevronLeft, Download, ShieldCheck, Smartphone, Wifi } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import './ZenithHub.css';

interface PilotPanelProps {
  onBack: () => void;
}

export const PilotPanel: React.FC<PilotPanelProps> = ({ onBack }) => {
  return (
    <div className="zh-hub-container">
      {/* Background radial glow */}
      <div className="zh-hub-glow" style={{ background: 'radial-gradient(circle at 80% 20%, rgba(203, 213, 225, 0.1) 0%, transparent 60%)' }} />

      {/* Header */}
      <header className="zh-hub-header animate-slide-down">
        <button onClick={onBack} className="zh-back-btn">
          <ChevronLeft size={16} /> Terug naar Zenith Hub
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: '#64748b' }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#4ade80', display: 'inline-block' }} />
          <span style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Alpha build beschikbaar</span>
        </div>
      </header>

      {/* Main Grid */}
      <div className="zh-pilot-grid animate-slide-up" style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '32px', marginTop: 16 }}>
        
        {/* Left Column: QR Code & Download Action */}
        <div className="zh-pilot-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 24px', textAlign: 'center' }}>
          <div style={{ 
            background: '#ffffff',
            borderRadius: 16,
            padding: 16,
            marginBottom: 24,
            boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
            display: 'inline-block'
          }}>
            <QRCodeSVG
              value="https://github.com/filipmonbaillieu24-prog/Hubio/releases"
              size={180}
              bgColor={"#ffffff"}
              fgColor={"#09090b"}
              level={"M"}
              includeMargin={false}
            />
          </div>

          <h2 style={{ fontSize: 20, fontWeight: 900, color: '#f8fafc', margin: '0 0 6px', fontFamily: 'Outfit, sans-serif' }}>Download Pilot</h2>
          <p style={{ fontSize: 12, color: '#94a3b8', margin: '0 0 24px', maxWidth: 280, lineHeight: 1.5 }}>
            Scan de QR-code met uw Android-toestel om de Pilot companion-app direct te downloaden en installeren.
          </p>

          <a 
            href="#"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              background: '#cbd5e1',
              color: '#09090b',
              textDecoration: 'none',
              padding: '12px 24px',
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 800,
              width: '100%',
              maxWidth: 240,
              boxSizing: 'border-box',
              transition: 'all 0.2s',
              boxShadow: '0 4px 12px rgba(203, 213, 225, 0.15)'
            }}
            onClick={(e) => { e.preventDefault(); alert('De alpha APK download start binnenkort...'); }}
          >
            <Download size={16} /> Directe Download (.apk)
          </a>
          <span style={{ fontSize: 9, color: '#64748b', marginTop: 8 }}>Versie 1.0.0-alpha • 14.8 MB</span>
        </div>

        {/* Right Column: Key Features & Instructions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          
          {/* App Info Card */}
          <div className="zh-pilot-card" style={{ padding: '24px 28px' }}>
            <h3 className="zh-pilot-card-title" style={{ fontSize: 14, marginBottom: 12 }}>
              <Smartphone size={16} /> Live In-Ear Audio Coach
            </h3>
            <p style={{ fontSize: 12, color: '#94a3b8', margin: '0 0 16px', lineHeight: 1.6 }}>
              Pilot is de onmisbare mobiele partner van het Zenith ecosysteem. Het functioneert als uw live spraakgestuurde coach tijdens het fietsen, direct gekoppeld aan uw trainingsschema's uit Aero.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', gap: 10 }}>
                <Wifi size={16} style={{ color: '#cbd5e1', flexShrink: 0, marginTop: 2 }} />
                <div>
                  <h4 style={{ margin: '0 0 2px', fontSize: 12, fontWeight: 700, color: '#f1f5f9' }}>Directe Sensor Koppeling</h4>
                  <p style={{ margin: 0, fontSize: 11, color: '#94a3b8', lineHeight: 1.4 }}>Maakt rechtstreeks verbinding met uw Bluetooth (BLE) hartslag-, cadans- en vermogensmeters.</p>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <ShieldCheck size={16} style={{ color: '#cbd5e1', flexShrink: 0, marginTop: 2 }} />
                <div>
                  <h4 style={{ margin: '0 0 2px', fontSize: 12, fontWeight: 700, color: '#f1f5f9' }}>Cloud Sync met Zenith</h4>
                  <p style={{ margin: 0, fontSize: 11, color: '#94a3b8', lineHeight: 1.4 }}>Synchroniseert uw geplande workouts automatisch vanuit de kalender en uploadt voltooide ritten direct.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Installation steps */}
          <div className="zh-pilot-card" style={{ padding: '24px 28px' }}>
            <h3 className="zh-pilot-card-title" style={{ fontSize: 14, marginBottom: 12 }}>
              Installatie-instructies
            </h3>
            <ol style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: '#94a3b8', display: 'flex', flexDirection: 'column', gap: 8, lineHeight: 1.5 }}>
              <li>
                <strong style={{ color: '#f1f5f9' }}>Download de APK:</strong> Scan de QR-code met de camera van uw telefoon of druk op de downloadknop.
              </li>
              <li>
                <strong style={{ color: '#f1f5f9' }}>Sta onbekende bronnen toe:</strong> Tik op de gedownloade melding en sta in de browserinstellingen toe om bestanden van deze bron te installeren indien gevraagd.
              </li>
              <li>
                <strong style={{ color: '#f1f5f9' }}>Installeer & Start:</strong> Volg de prompts om de installatie te voltooien en open de <strong style={{ color: '#cbd5e1' }}>Pilot</strong> app.
              </li>
              <li>
                <strong style={{ color: '#f1f5f9' }}>Log in met Zenith:</strong> Gebruik uw Zenith inloggegevens om verbinding te maken met uw profiel en live ritten te synchroniseren.
              </li>
            </ol>
          </div>

        </div>

      </div>
    </div>
  );
};
