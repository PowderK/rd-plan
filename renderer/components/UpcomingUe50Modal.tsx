import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  getFiftiethBirthday,
  getFiftiethBirthdayISO,
  getFiftiethBirthdayYM,
  isApproachingFiftiethBirthday
} from '../utils/personPeriods';

interface UpcomingUe50ModalProps {
  onDecided?: () => void;
}

export const UpcomingUe50Modal: React.FC<UpcomingUe50ModalProps> = ({ onDecided }) => {
  const { currentUser, isAuthenticated, hasPermission } = useAuth();
  const [pendingList, setPendingList] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [dismissed, setDismissed] = useState<boolean>(false);
  const [ue50QualName, setUe50QualName] = useState<string>('Ü50');
  const [rdQualName, setRdQualName] = useState<string>('Rettungsdienst');

  // Nur RTW-Planer (mit Schreibrechten auf Einteilung / Administrator / Planer-Rolle)
  const isRtwPlaner = Boolean(
    isAuthenticated && (
      hasPermission('einteilung', 'write') ||
      currentUser?.roleName === 'Administrator' ||
      (currentUser?.roleName && currentUser.roleName.toLowerCase().includes('planer'))
    )
  );

  useEffect(() => {
    if (!isAuthenticated || !isRtwPlaner) return;

    // Wurde das Modal in dieser Browser-Sitzung bereits weggeklickt?
    if (sessionStorage.getItem('ue50_modal_dismissed') === 'true') {
      setDismissed(true);
      return;
    }

    const checkBirthdays = async () => {
      try {
        setLoading(true);

        // Prüfe ob Feature "Automatische Ü50-Berechnung" aktiv ist
        const dept = currentUser?.assignedDepartment && currentUser.assignedDepartment !== 'all'
          ? currentUser.assignedDepartment
          : '1. Abteilung';
        const [featAuto, globAuto] = await Promise.all([
          (window as any).api.getSetting?.(`feature_auto_ue50_${dept}`),
          (window as any).api.getSetting?.('feature_auto_ue50')
        ]);
        const isEnabled = featAuto !== null && featAuto !== undefined
          ? (featAuto === 'true' || featAuto === true || featAuto === '1')
          : (globAuto === null || globAuto === undefined ? true : (globAuto === 'true' || globAuto === true || globAuto === '1'));

        if (!isEnabled) {
          setPendingList([]);
          setLoading(false);
          return;
        }

        // Lade Qualifikationsbezeichnungen aus Einstellungen
        const [ue50Setting, rdSetting] = await Promise.all([
          (window as any).api.getSetting?.('ue50_qualification_type'),
          (window as any).api.getSetting?.('rettungsdienst_qualification_type')
        ]);
        const qUe50 = ue50Setting ? String(ue50Setting) : 'Ü50';
        const qRd = rdSetting ? String(rdSetting) : 'Rettungsdienst';
        setUe50QualName(qUe50);
        setRdQualName(qRd);

        // Lade alle Personen und Qualifikationsperioden
        const [allPersonnel, allPeriods] = await Promise.all([
          (window as any).api.getPersonnel?.(false),
          (window as any).api.getAllQualificationPeriods?.()
        ]);

        if (!Array.isArray(allPersonnel)) {
          setLoading(false);
          return;
        }

        const periodsByPerson: Record<number, any[]> = {};
        if (Array.isArray(allPeriods)) {
          for (const per of allPeriods) {
            const pid = Number(per.personId);
            if (!pid) continue;
            if (!periodsByPerson[pid]) periodsByPerson[pid] = [];
            periodsByPerson[pid].push(per);
          }
        }

        const candidates: any[] = [];
        for (const p of allPersonnel) {
          if (!p.birthDate) continue;

          const approaching = isApproachingFiftiethBirthday(p.birthDate);
          if (!approaching || !approaching.isApproaching) continue;

          const bdayYM = getFiftiethBirthdayYM(p.birthDate);
          if (!bdayYM) continue;

          const pPeriods = periodsByPerson[p.id] || [];

          // Prüfe, ob die Person überhaupt die Rettungsdienst-Qualifikation besitzt
          const hasRd = pPeriods.some((q: any) =>
            q.qualType === qRd &&
            q.active !== false
          );
          if (!hasRd) continue;

          // Prüfe, ob bereits entschieden wurde:
          // 1. Bereits Ü50 für diesen Monat/Geburtstag eingetragen?
          const hasUe50 = pPeriods.some((q: any) =>
            q.qualType === qUe50 &&
            q.active !== false &&
            q.startYM <= bdayYM &&
            (!q.endYM || q.endYM >= bdayYM)
          );
          if (hasUe50) continue;

          // 2. Bereits Rettungsdienst-Qualifikation zum 50. Geburtstag terminiert?
          const isRdTerminated = pPeriods.some((q: any) =>
            q.qualType === qRd &&
            q.active !== false &&
            q.endYM &&
            q.endYM <= bdayYM
          );
          if (isRdTerminated) continue;

          // Noch unentschieden!
          candidates.push({
            ...p,
            birthdayISO: approaching.birthdayISO,
            birthdayDate: approaching.birthdayDate,
            daysRemaining: approaching.daysRemaining,
            bdayYM
          });
        }

        setPendingList(candidates);
      } catch (err) {
        console.error('[UpcomingUe50Modal] Fehler beim Prüfen der Geburtstage:', err);
      } finally {
        setLoading(false);
      }
    };

    checkBirthdays();
  }, [isAuthenticated, isRtwPlaner]);

  if (!isAuthenticated || !isRtwPlaner || dismissed || pendingList.length === 0) {
    return null;
  }

  const currentPerson = pendingList[0];
  const bdayDate = currentPerson.birthdayDate as Date;
  const bdayFormatted = bdayDate ? bdayDate.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '';
  const [bYear, bMonth] = currentPerson.bdayYM.split('-').map(Number);
  const monthNamesDe = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
  const monthLabel = monthNamesDe[bMonth - 1] || currentPerson.bdayYM;

  const handleKeepAsUe50 = async () => {
    try {
      setLoading(true);
      const bdayYM = currentPerson.bdayYM;

      // 1. Füge Ü50-Qualifikation ab Geburtsmonat hinzu
      await (window as any).api.addQualificationPeriod({
        personId: currentPerson.id,
        qualType: ue50QualName,
        startYM: bdayYM,
        endYM: null,
        active: true
      });

      // 2. Falls eine RD-Periode mit endYM existierte, endYM entfernen
      const pPeriods = await (window as any).api.getQualificationPeriods?.(currentPerson.id) || [];
      const rdPeriod = pPeriods.find((q: any) => q.qualType === rdQualName && q.endYM && q.endYM <= bdayYM);
      if (rdPeriod) {
        await (window as any).api.updateQualificationPeriod(rdPeriod.id, {
          ...rdPeriod,
          endYM: null
        });
      }

      setPendingList(prev => prev.filter(p => p.id !== currentPerson.id));
      onDecided?.();
    } catch (e: any) {
      alert('Fehler beim Speichern der Ü50-Einstufung: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveFromRoster = async () => {
    try {
      setLoading(true);
      const bdayYM = currentPerson.bdayYM;

      // 1. Lade bestehende Qualifikationsperioden
      const pPeriods = await (window as any).api.getQualificationPeriods?.(currentPerson.id) || [];
      const rdPeriods = pPeriods.filter((q: any) => q.qualType === rdQualName && q.active !== false);

      if (rdPeriods.length > 0) {
        for (const rdp of rdPeriods) {
          await (window as any).api.updateQualificationPeriod(rdp.id, {
            ...rdp,
            endYM: bdayYM
          });
        }
      } else {
        // Falls keine explizite RD-Periode hinterlegt war, erstelle eine mit endYM = bdayYM
        const currentYear = new Date().getFullYear();
        await (window as any).api.addQualificationPeriod({
          personId: currentPerson.id,
          qualType: rdQualName,
          startYM: `${currentYear - 5}-01`,
          endYM: bdayYM,
          active: true
        });
      }

      // 2. Eventuell vorhandene Ü50-Perioden entfernen
      const ue50Periods = pPeriods.filter((q: any) => q.qualType === ue50QualName);
      for (const u of ue50Periods) {
        await (window as any).api.deleteQualificationPeriod(u.id);
      }

      setPendingList(prev => prev.filter(p => p.id !== currentPerson.id));
      onDecided?.();
    } catch (e: any) {
      alert('Fehler beim Beenden der Rettungsdienst-Qualifikation: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = () => {
    sessionStorage.setItem('ue50_modal_dismissed', 'true');
    setDismissed(true);
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(15, 23, 42, 0.72)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '20px',
        animation: 'fadeIn 0.2s ease-out'
      }}
    >
      <div
        style={{
          background: '#ffffff',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '560px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          border: '1px solid rgba(226, 232, 240, 0.8)',
          fontFamily: 'inherit'
        }}
      >
        {/* Header mit festlichem Badge */}
        <div
          style={{
            background: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 60%, #3b82f6 100%)',
            color: 'white',
            padding: '24px 28px 20px',
            position: 'relative'
          }}
        >
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              background: 'rgba(255, 255, 255, 0.18)',
              padding: '4px 12px',
              borderRadius: '999px',
              fontSize: '12px',
              fontWeight: 600,
              letterSpacing: '0.5px',
              marginBottom: '10px'
            }}
          >
            <span>50. GEBURTSTAG STEHT BEVOR</span>
          </div>
          <h2
            style={{
              margin: '0 0 6px 0',
              fontSize: '22px',
              fontWeight: 700,
              letterSpacing: '-0.3px',
              color: '#ffffff'
            }}
          >
            {currentPerson.vorname} {currentPerson.name}
          </h2>
          <div style={{ fontSize: '13px', opacity: 0.9 }}>
            {currentPerson.personnelNumber ? `Personalnr. ${currentPerson.personnelNumber} · ` : ''}
            {currentPerson.department || '1. Abteilung'}
          </div>
        </div>

        {/* Content Body */}
        <div style={{ padding: '24px 28px', color: '#1e293b' }}>
          <div
            style={{
              padding: '14px 16px',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '10px',
              marginBottom: '20px',
              fontSize: '14px',
              lineHeight: 1.5
            }}
          >
            Der Kollege vollendet am <strong>{bdayFormatted}</strong> das 50. Lebensjahr{' '}
            {currentPerson.daysRemaining > 0 ? (
              <span style={{ color: '#2563eb', fontWeight: 600 }}>
                (in {currentPerson.daysRemaining} {currentPerson.daysRemaining === 1 ? 'Tag' : 'Tagen'})
              </span>
            ) : (
              <span style={{ color: '#d97706', fontWeight: 600 }}>
                (bereits erreicht)
              </span>
            )}
            . Ab diesem Moment scheidet er regulär aus der RTW-Planung aus.
            <div style={{ marginTop: '6px', color: '#475569', fontSize: '13px' }}>
              Bitte wählen Sie die gewünschte Vorgehensweise für die Dienstplanung:
            </div>
          </div>

          {/* Option A: Als Ü50 belassen */}
          <div
            style={{
              border: '2px solid #3b82f6',
              background: '#eff6ff',
              borderRadius: '12px',
              padding: '16px 18px',
              marginBottom: '14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              transition: 'all 0.15s ease'
            }}
          >
            <div>
              <div style={{ fontWeight: 700, fontSize: '15px', color: '#1e40af' }}>
                Als Ü50er in der RTW-Planung belassen
              </div>
              <div style={{ fontSize: '13px', color: '#334155', marginTop: '3px', lineHeight: 1.4 }}>
                Der Kollege erhält ab <strong>{monthLabel} {bYear}</strong> den Ü50-Status. Er unterstützt
                das Team weiterhin bei Bedarf und übernimmt Schichten wie ein Azubi (Jahres-Soll = 0).
              </div>
            </div>
            <button
              type="button"
              disabled={loading}
              onClick={handleKeepAsUe50}
              style={{
                alignSelf: 'flex-end',
                background: '#2563eb',
                color: '#ffffff',
                border: 'none',
                padding: '9px 18px',
                borderRadius: '8px',
                fontWeight: 600,
                fontSize: '13px',
                cursor: loading ? 'not-allowed' : 'pointer',
                boxShadow: '0 2px 4px rgba(37, 99, 235, 0.25)'
              }}
            >
              Als Ü50er übernehmen
            </button>
          </div>

          {/* Option B: Aus Liste entfernen */}
          <div
            style={{
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              borderRadius: '12px',
              padding: '16px 18px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}
          >
            <div>
              <div style={{ fontWeight: 700, fontSize: '15px', color: '#334155' }}>
                Ab 50. Geburtstag aus Liste entfernen
              </div>
              <div style={{ fontSize: '13px', color: '#64748b', marginTop: '3px', lineHeight: 1.4 }}>
                Die Rettungsdienst-Qualifikation wird zum <strong>{monthLabel} {bYear}</strong> beendet. Der
                Kollege wird ab dem Folgemonat nicht mehr im RTW-Dienstplan aufgeführt.
              </div>
            </div>
            <button
              type="button"
              disabled={loading}
              onClick={handleRemoveFromRoster}
              style={{
                alignSelf: 'flex-end',
                background: '#ffffff',
                color: '#dc2626',
                border: '1px solid #fca5a5',
                padding: '8px 16px',
                borderRadius: '8px',
                fontWeight: 600,
                fontSize: '13px',
                cursor: loading ? 'not-allowed' : 'pointer'
              }}
            >
              Aus RTW-Planung entfernen
            </button>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '14px 28px',
            background: '#f8fafc',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <div style={{ fontSize: '12px', color: '#64748b' }}>
            {pendingList.length > 1
              ? `Person 1 von ${pendingList.length} anstehenden Geburtstagen`
              : 'Entscheidung erforderlich'}
          </div>
          <button
            type="button"
            onClick={handleDismiss}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#64748b',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 500,
              padding: '6px 12px',
              borderRadius: '6px'
            }}
          >
            Später entscheiden
          </button>
        </div>
      </div>
    </div>
  );
};

export default UpcomingUe50Modal;
