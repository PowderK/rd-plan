import React, { useState } from 'react';

interface LoginProps {
  onLoginSuccess: () => void;
  onLogin: (personnelNumber: string) => Promise<{ success: boolean; error?: string }>;
}

const Login: React.FC<LoginProps> = ({ onLoginSuccess, onLogin }) => {
  const [personnelNumber, setPersonnelNumber] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!personnelNumber.trim()) {
      setError('Bitte Personalnummer eingeben');
      return;
    }

    setLoading(true);
    setError('');

    const result = await onLogin(personnelNumber.trim());

    if (result.success) {
      onLoginSuccess();
    } else {
      setError(result.error || 'Login fehlgeschlagen');
      setLoading(false);
    }
  };

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
    }}>
      <div style={{
        background: 'white',
        borderRadius: '12px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        padding: '48px',
        width: '100%',
        maxWidth: '420px'
      }}>
        <h1 style={{
          fontSize: '28px',
          fontWeight: '700',
          color: '#333',
          marginBottom: '8px',
          textAlign: 'center'
        }}>
          RD-Plan
        </h1>
        <p style={{
          fontSize: '14px',
          color: '#666',
          marginBottom: '32px',
          textAlign: 'center'
        }}>
          Bitte mit Personalnummer anmelden
        </p>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '24px' }}>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '600',
              color: '#333',
              marginBottom: '8px'
            }}>
              Personalnummer
            </label>
            <input
              type="text"
              value={personnelNumber}
              onChange={(e) => setPersonnelNumber(e.target.value)}
              placeholder="z.B. admin"
              disabled={loading}
              autoFocus
              style={{
                width: '100%',
                padding: '12px 16px',
                fontSize: '16px',
                border: '2px solid #e0e0e0',
                borderRadius: '8px',
                outline: 'none',
                transition: 'border-color 0.2s',
                boxSizing: 'border-box'
              }}
              onFocus={(e) => e.target.style.borderColor = '#667eea'}
              onBlur={(e) => e.target.style.borderColor = '#e0e0e0'}
            />
          </div>

          {error && (
            <div style={{
              background: '#fee',
              border: '1px solid #fcc',
              borderRadius: '6px',
              padding: '12px',
              marginBottom: '24px',
              color: '#c33',
              fontSize: '14px'
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '14px',
              fontSize: '16px',
              fontWeight: '600',
              color: 'white',
              background: loading ? '#999' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              border: 'none',
              borderRadius: '8px',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'transform 0.1s, box-shadow 0.2s',
              boxShadow: loading ? 'none' : '0 4px 12px rgba(102, 126, 234, 0.4)'
            }}
            onMouseOver={(e) => !loading && (e.currentTarget.style.transform = 'translateY(-2px)')}
            onMouseOut={(e) => !loading && (e.currentTarget.style.transform = 'translateY(0)')}
          >
            {loading ? 'Anmeldung läuft...' : 'Anmelden'}
          </button>
        </form>

        <div style={{
          marginTop: '32px',
          paddingTop: '24px',
          borderTop: '1px solid #e0e0e0',
          textAlign: 'center'
        }}>
          <p style={{
            fontSize: '12px',
            color: '#999',
            margin: 0
          }}>
            Standard Admin-Zugang: <strong>admin</strong>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
