import React, { useState, useEffect, useRef } from 'react';
import { Brain, Send, User, Settings } from 'lucide-react';
import { getAISettings, sendAIChat, AIChatMessage } from '../../utils/ai';
import { FitnessProfile, RideSummaryWithBests } from '../../types/workout';
import { computePMC } from '../../utils/pmc';

interface AICoachChatWidgetProps {
  profile: FitnessProfile;
  rides: RideSummaryWithBests[];
  onGoToSettings?: () => void;
}

export const AICoachChatWidget: React.FC<AICoachChatWidgetProps> = ({ profile, rides, onGoToSettings }) => {
  const [provider, setProvider] = useState<'disabled' | 'ollama' | 'openai'>('disabled');
  const [messages, setMessages] = useState<AIChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load provider settings
  useEffect(() => {
    const settings = getAISettings();
    setProvider(settings.provider);

    // Initial welcome message
    if (settings.provider !== 'disabled') {
      const name = profile.name || 'Atleet';
      setMessages([
        {
          role: 'assistant',
          content: `Hoi ${name}! Ik ben je persoonlijke Cyclo Coach. Ik heb toegang tot je fitheidscijfers en trainingsgeschiedenis. Stel me gerust al je vragen over je ritten, trainingszones, voeding of hersteladviezen. Hoe voelen de benen vandaag?`,
        },
      ]);
    }
  }, [profile.name]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  // Generate system prompt with full athlete context
  const getSystemContext = () => {
    const name = profile.name || 'Atleet';
    const age = profile.birthDate
      ? Math.floor((Date.now() - new Date(profile.birthDate).getTime()) / (365.25 * 24 * 3600 * 1000))
      : 'Onbekend';
    const weight = profile.weight || 75;
    const ftp = profile.ftp || 220;
    const lthr = profile.lthr || 170;

    // Calculate PMC
    const tssList = rides
      .filter(r => (r.tss ?? r.hrTSS) != null)
      .map(r => ({ date: r.date, tss: (r.tss ?? r.hrTSS)! }));
    const points = computePMC(tssList);
    const latest = points[points.length - 1] ?? { ctl: 0, atl: 0, tsb: 0 };

    // Format recent rides history
    const recentRides = [...rides]
      .sort((a, b) => b.date - a.date)
      .slice(0, 5)
      .map(r => {
        const dateStr = new Date(r.date).toLocaleDateString('nl-BE');
        const rpeStr = (r as any).rpe ? `RPE: ${(r as any).rpe}/10` : 'RPE: onbekend';
        return `- ${dateStr}: ${r.distance.toFixed(0)}km, duur: ${(r.duration/3600).toFixed(1)}u, ${rpeStr}, opmerkingen: ${r.notes || 'geen'}`;
      })
      .join('\n');

    return `Je bent de persoonlijke wielercoach van de atleet.
Gegevens van de atleet:
- Naam: ${name}
- Leeftijd: ${age}
- Gewicht: ${weight} kg
- FTP: ${ftp} Watt
- LTHR (drempelhartslag): ${lthr} bpm

Actuele fitheidscijfers:
- CTL (Fitheid): ${Math.round(latest.ctl)}
- ATL (Vermoeidheid): ${Math.round(latest.atl)}
- TSB (Vorm/Frisheid): ${Math.round(latest.tsb)} (een negatieve TSB betekent vermoeidheid, beneden de -20 is risicovol)

Recente trainingsgeschiedenis:
${recentRides}

Houd hier rekening mee in je adviezen. Geef korte, concrete, direct toepasbare coachingadviezen in begrijpelijk Nederlands. Gebruik NOOIT emojis in je antwoorden.`;
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || sending) return;

    const userMessage = input.trim();
    setInput('');
    setError(null);

    const updatedMessages = [...messages, { role: 'user', content: userMessage } as AIChatMessage];
    setMessages(updatedMessages);
    setSending(true);

    try {
      const response = await sendAIChat(updatedMessages, getSystemContext());
      setMessages([...updatedMessages, { role: 'assistant', content: response }]);
    } catch (err: any) {
      setError(err.message || 'Kon geen verbinding maken met de AI.');
    } finally {
      setSending(false);
    }
  };

  if (provider === 'disabled') {
    return (
      <div
        className="wd-section-card animate-slide-up"
        style={{
          padding: 20,
          background: 'linear-gradient(135deg, rgba(255,255,255,0.01) 0%, rgba(255,255,255,0.005) 100%)',
          border: '1px solid rgba(255,255,255,0.05)',
          borderRadius: 12,
          marginBottom: 20,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <Brain size={22} style={{ color: '#64748b' }} />
          <h4 style={{ margin: 0, fontSize: 13, fontWeight: 800, color: '#f8fafc', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
            Interactieve AI Coach Chat
          </h4>
        </div>
        <p style={{ margin: '0 0 14px', fontSize: 11, color: '#94a3b8', lineHeight: 1.5 }}>
          De interactieve AI-coach is momenteel uitgeschakeld. Koppel een lokale **Ollama** server (gratis en 100% offline) of voeg een **OpenAI API-sleutel** toe in de instellingen om live advies te krijgen over je ritten en vermoeidheid.
        </p>
        {onGoToSettings && (
          <button
            onClick={onGoToSettings}
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.07)',
              color: '#cbd5e1',
              borderRadius: 8,
              padding: '6px 14px',
              fontSize: 10,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              fontFamily: 'inherit',
            }}
          >
            <Settings size={12} /> AI Instellingen Openen
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      className="wd-section-card animate-slide-up"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: 380,
        marginBottom: 20,
        border: '1px solid rgba(0, 229, 255, 0.08)',
        background: 'linear-gradient(135deg, rgba(0, 229, 255, 0.015) 0%, rgba(255,255,255,0.005) 100%)',
        padding: 0,
        overflow: 'hidden',
        borderRadius: 14,
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '10px 16px',
          borderBottom: '1px solid rgba(255,255,255,0.04)',
          background: 'rgba(255,255,255,0.005)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Brain size={18} style={{ color: '#00e5ff' }} />
          <div>
            <h4 style={{ margin: 0, fontSize: 12, fontWeight: 800, color: '#f8fafc', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
              Interactief Coach Gesprek
            </h4>
            <span style={{ fontSize: 9, color: '#64748b', display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#34d399', display: 'inline-block' }} /> Live verbonden ({provider === 'ollama' ? 'Lokaal' : 'OpenAI'})
            </span>
          </div>
        </div>
      </div>

      {/* Messages viewport */}
      <div style={{ flex: 1, padding: 14, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {messages.map((m, idx) => {
          const isUser = m.role === 'user';
          return (
            <div
              key={idx}
              style={{
                alignSelf: isUser ? 'flex-end' : 'flex-start',
                maxWidth: '85%',
                display: 'flex',
                gap: 8,
                flexDirection: isUser ? 'row-reverse' : 'row',
              }}
            >
              <div
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: '50%',
                  background: isUser ? 'rgba(0,229,255,0.1)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${isUser ? 'rgba(0,229,255,0.2)' : 'rgba(255,255,255,0.05)'}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 10,
                  color: isUser ? '#00e5ff' : '#64748b',
                  flexShrink: 0,
                  marginTop: 2,
                }}
              >
                {isUser ? <User size={11} /> : <Brain size={11} />}
              </div>
              <div
                style={{
                  padding: '8px 12px',
                  borderRadius: 10,
                  fontSize: 11,
                  lineHeight: 1.5,
                  background: isUser ? 'rgba(0, 229, 255, 0.04)' : 'rgba(255,255,255,0.015)',
                  border: `1px solid ${isUser ? 'rgba(0, 229, 255, 0.08)' : 'rgba(255,255,255,0.04)'}`,
                  color: '#cbd5e1',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {m.content}
              </div>
            </div>
          );
        })}

        {/* Typing indicator */}
        {sending && (
          <div style={{ alignSelf: 'flex-start', display: 'flex', gap: 8, alignItems: 'center' }}>
            <div
              style={{
                width: 22,
                height: 22,
                borderRadius: '50%',
                background: 'rgba(255,255,255,0.03)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Brain size={11} style={{ color: '#64748b' }} />
            </div>
            <div style={{ display: 'flex', gap: 3, padding: '10px 14px', background: 'rgba(255,255,255,0.015)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.03)' }}>
              <span className="typing-dot" style={{ width: 4, height: 4, background: '#64748b', borderRadius: '50%' }} />
              <span className="typing-dot" style={{ width: 4, height: 4, background: '#64748b', borderRadius: '50%', animationDelay: '0.2s' }} />
              <span className="typing-dot" style={{ width: 4, height: 4, background: '#64748b', borderRadius: '50%', animationDelay: '0.4s' }} />
            </div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div style={{ alignSelf: 'center', margin: '6px 0', padding: '6px 12px', background: 'rgba(248,113,113,0.05)', border: '1px solid rgba(248,113,113,0.15)', borderRadius: 8, fontSize: 10, color: '#f87171' }}>
            {error}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      <form
        onSubmit={handleSend}
        style={{
          padding: '8px 12px',
          borderTop: '1px solid rgba(255,255,255,0.04)',
          background: 'rgba(255,255,255,0.005)',
          display: 'flex',
          gap: 8,
        }}
      >
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Stel een vraag aan de coach over je ritten of herstel..."
          disabled={sending}
          style={{
            flex: 1,
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 8,
            padding: '8px 12px',
            fontSize: 11,
            color: '#f8fafc',
            outline: 'none',
            fontFamily: 'inherit',
          }}
        />
        <button
          type="submit"
          disabled={!input.trim() || sending}
          style={{
            background: input.trim() && !sending ? 'linear-gradient(135deg, #00e5ff, #39ff14)' : 'rgba(255,255,255,0.02)',
            color: input.trim() && !sending ? '#09090b' : '#475569',
            border: 'none',
            borderRadius: 8,
            width: 32,
            height: 32,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: input.trim() && !sending ? 'pointer' : 'default',
            transition: 'all 0.15s',
          }}
        >
          <Send size={12} />
        </button>
      </form>
    </div>
  );
};
