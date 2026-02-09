// ═══════════════════════════════════════════════════════════════════════════
// FLOATING COMMAND PANEL — AI Helper + Settings Search + Auto-Tune
// ═══════════════════════════════════════════════════════════════════════════
// Always-visible, minimizable floating panel at the top of the window.
// Features:
//   • Search any setting across ECU/Vehicle/Drivetrain — live autocomplete
//   • AI natural language commands ("make it run 10s quarter mile")
//   • Auto-tune goal entry with constraint toggles
//   • Non-blocking — never covers critical UI
// ═══════════════════════════════════════════════════════════════════════════

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { type EcuConfig, getDefaultEcuConfig } from '@/lib/engineSim';
import { autoTune, getDefaultConstraints, type AutoTuneGoal, type TargetType, type AutoTuneConstraints, type AutoTuneResult } from '@/lib/autoTune';
import { log, getLogBuffer, onLogEntry, type LogEntry } from '@shared/logger';

// ── Setting metadata for search ─────────────────────────────────────────
interface SettingMeta {
  key: string;
  label: string;
  category: string;
  type: 'number' | 'boolean' | 'string' | 'array';
}

function buildSettingIndex(): SettingMeta[] {
  const defaults = getDefaultEcuConfig();
  const settings: SettingMeta[] = [];

  for (const [key, value] of Object.entries(defaults)) {
    if (Array.isArray(value) && value.length > 100) continue; // skip large tables
    const label = key
      .replace(/([A-Z])/g, ' $1')
      .replace(/([a-z])(\d)/g, '$1 $2')
      .trim();
    const category = getCategoryForKey(key);
    const type: SettingMeta['type'] =
      typeof value === 'boolean' ? 'boolean' :
      typeof value === 'number' ? 'number' :
      typeof value === 'string' ? 'string' : 'array';
    settings.push({ key, label, category, type });
  }

  return settings;
}

function getCategoryForKey(key: string): string {
  if (/vtec|cam|lift|duration/i.test(key)) return 'VTEC / Cam';
  if (/turbo|boost|wastegate|antiLag/i.test(key)) return 'Turbo';
  if (/nitrous/i.test(key)) return 'Nitrous';
  if (/fuel|injector|afr|lambda|ethanol|octane/i.test(key)) return 'Fuel';
  if (/ignition|timing|spark|dwell|knock/i.test(key)) return 'Ignition';
  if (/gear|transmission|clutch|finalDrive|shift/i.test(key)) return 'Transmission';
  if (/tire|wheel|grip|slip|compound/i.test(key)) return 'Tires / Wheels';
  if (/drag|frontal|aero|wing/i.test(key)) return 'Aerodynamics';
  if (/suspension|camber|toe|spring|damper|sway|ride/i.test(key)) return 'Suspension';
  if (/brake|rotor|caliper|pad/i.test(key)) return 'Brakes';
  if (/weight|mass|bias|cg/i.test(key)) return 'Weight / Balance';
  if (/exhaust|header|cat|muffler/i.test(key)) return 'Exhaust';
  if (/intake|throttle|manifold|plenum/i.test(key)) return 'Intake';
  if (/idle|iacv/i.test(key)) return 'Idle Control';
  if (/launch|twoStep|traction/i.test(key)) return 'Launch / Traction';
  if (/rpm|redline|revLimit|speedLimiter/i.test(key)) return 'Rev Limit';
  if (/oil|coolant|fan|temp/i.test(key)) return 'Cooling / Lube';
  if (/can[A-Z]|obd|emission|catalyst|egr/i.test(key)) return 'CAN / OBD';
  if (/data[Ll]og|aux|shiftLight/i.test(key)) return 'Data / Aux';
  if (/drivetrain|diff|awd/i.test(key)) return 'Drivetrain';
  if (/weather|ambient|humidity|altitude/i.test(key)) return 'Environment';
  if (/safety|cage|harness|fire|kill/i.test(key)) return 'Safety';
  if (/body|hood|trunk|seat|carpet|window|bumper|fender|door/i.test(key)) return 'Body / Chassis';
  if (/color|tint|paint/i.test(key)) return 'Cosmetic';
  if (/compression/i.test(key)) return 'Engine Internals';
  if (/supercharger/i.test(key)) return 'Supercharger';
  if (/intercooler/i.test(key)) return 'Intercooler';
  if (/map[A-Z]|o2[A-Z]|sensor/i.test(key)) return 'Sensors';
  return 'General';
}

// ── Parse natural language commands into auto-tune goals ────────────────
function parseCommand(input: string): AutoTuneGoal | null {
  const lower = input.toLowerCase().trim();
  const constraints = getDefaultConstraints();

  // Parse constraints from text
  if (/pump\s*gas|street\s*gas|91|93/.test(lower)) constraints.pumpGasOnly = true;
  if (/nitrous|nos|n2o|spray/.test(lower)) constraints.nitrousAllowed = true;
  if (/all\s*motor|na only|naturally\s*aspirated/.test(lower)) {
    constraints.allMotor = true;
    constraints.turboAllowed = false;
    constraints.superchargerAllowed = false;
    constraints.nitrousAllowed = false;
  }
  if (/turbo|forced\s*induction/.test(lower)) constraints.turboAllowed = true;
  if (/drag\s*slick/.test(lower)) constraints.tireDragSlick = true;
  if (/street\s*legal/.test(lower)) constraints.streetLegal = true;
  if (/race|track|no\s*street/.test(lower)) constraints.streetLegal = false;
  if (/cage|caged/.test(lower)) constraints.safetyRating = 'full_cage';

  // Parse target
  let match: RegExpMatchArray | null;

  // Quarter mile
  match = lower.match(/(\d+\.?\d*)\s*(?:second|sec|s)?\s*(?:quarter|1\/4|qm|quarter\s*mile)/);
  if (!match) match = lower.match(/quarter\s*mile\s*(?:in\s*)?(\d+\.?\d*)/);
  if (match) {
    return { targetType: 'quarter_mile', targetValue: parseFloat(match[1]), constraints };
  }

  // HP
  match = lower.match(/(\d+)\s*(?:hp|horsepower|whp|bhp)/);
  if (match) {
    return { targetType: 'horsepower', targetValue: parseInt(match[1]), constraints };
  }

  // Torque
  match = lower.match(/(\d+)\s*(?:ft[\s-]*lb|torque|ft[\s-]*lbs|lb[\s-]*ft)/);
  if (match) {
    return { targetType: 'torque', targetValue: parseInt(match[1]), constraints };
  }

  // Top speed
  match = lower.match(/(\d+)\s*(?:mph|top\s*speed)/);
  if (!match) match = lower.match(/top\s*speed\s*(?:of\s*)?(\d+)/);
  if (match) {
    return { targetType: 'top_speed', targetValue: parseInt(match[1]), constraints };
  }

  // 60-foot
  match = lower.match(/(\d+\.?\d*)\s*(?:sec|s)?\s*(?:60\s*(?:ft|foot))/);
  if (match) {
    return { targetType: 'sixty_foot', targetValue: parseFloat(match[1]), constraints };
  }

  return null;
}

// ── Component Props ────────────────────────────────────────────────────
export interface FloatingPanelProps {
  ecuConfig: EcuConfig;
  onConfigChange: (config: EcuConfig) => void;
  onSettingNavigate?: (key: string) => void;
}

// ── Styles ─────────────────────────────────────────────────────────────
const panelBase: React.CSSProperties = {
  position: 'fixed',
  top: 8,
  right: 8,
  zIndex: 9999,
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: 11,
  color: '#ccc',
  userSelect: 'none',
};

const panelExpanded: React.CSSProperties = {
  ...panelBase,
  width: 420,
  maxHeight: '80vh',
  background: 'rgba(10, 10, 26, 0.95)',
  borderRadius: 12,
  border: '1px solid rgba(163, 230, 53, 0.25)',
  boxShadow: '0 8px 32px rgba(0,0,0,0.6), 0 0 12px rgba(163, 230, 53, 0.08)',
  backdropFilter: 'blur(12px)',
  overflow: 'hidden',
};

const panelMinimized: React.CSSProperties = {
  ...panelBase,
  cursor: 'pointer',
};

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════
export function FloatingCommandPanel({ ecuConfig, onConfigChange, onSettingNavigate }: FloatingPanelProps) {
  const [minimized, setMinimized] = useState(true);
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<'search' | 'autotune' | 'logs'>('search');
  const [searchResults, setSearchResults] = useState<SettingMeta[]>([]);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  // Auto-tune state
  const [autoTuneTargetType, setAutoTuneTargetType] = useState<TargetType>('quarter_mile');
  const [autoTuneValue, setAutoTuneValue] = useState('12.0');
  const [constraints, setConstraints] = useState<AutoTuneConstraints>(getDefaultConstraints());
  const [autoTuneResult, setAutoTuneResult] = useState<AutoTuneResult | null>(null);
  const [autoTuneActive, setAutoTuneActive] = useState(false);

  // Logs state
  const [logEntries, setLogEntries] = useState<LogEntry[]>([]);
  const logEndRef = useRef<HTMLDivElement>(null);

  const settingIndex = useMemo(() => buildSettingIndex(), []);
  const inputRef = useRef<HTMLInputElement>(null);

  // Subscribe to log entries
  useEffect(() => {
    setLogEntries(getLogBuffer().slice(-100));
    const unsub = onLogEntry((entry: LogEntry) => {
      setLogEntries(prev => [...prev.slice(-99), entry]);
    });
    return unsub;
  }, []);

  // Auto-scroll logs
  useEffect(() => {
    if (tab === 'logs') logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logEntries, tab]);

  // Search
  useEffect(() => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    const q = query.toLowerCase();
    const results = settingIndex.filter(s =>
      s.key.toLowerCase().includes(q) ||
      s.label.toLowerCase().includes(q) ||
      s.category.toLowerCase().includes(q)
    ).slice(0, 20);
    setSearchResults(results);
  }, [query, settingIndex]);

  // Focus input when expanded
  useEffect(() => {
    if (!minimized && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [minimized]);

  // Handle inline setting change
  const handleSettingChange = useCallback((key: string, value: string) => {
    const newConfig = { ...ecuConfig };
    const currentVal = (newConfig as any)[key];

    if (typeof currentVal === 'boolean') {
      (newConfig as any)[key] = value === 'true';
    } else if (typeof currentVal === 'number') {
      const num = parseFloat(value);
      if (!isNaN(num)) (newConfig as any)[key] = num;
    } else {
      (newConfig as any)[key] = value;
    }

    log.info('panel', `Setting changed: ${key} = ${value}`);
    onConfigChange(newConfig);
    setEditingKey(null);
  }, [ecuConfig, onConfigChange]);

  // Handle command/search submit
  const handleSubmit = useCallback(() => {
    if (!query.trim()) return;
    const goal = parseCommand(query);
    if (goal) {
      log.info('panel', `AI command parsed: ${goal.targetType} = ${goal.targetValue}`, goal);
      const result = autoTune(ecuConfig, goal);
      setAutoTuneResult(result);
      setTab('autotune');
      setQuery('');
    }
  }, [query, ecuConfig]);

  // Apply auto-tune result
  const applyAutoTune = useCallback(() => {
    if (autoTuneResult) {
      log.info('panel', 'Auto-tune applied', {
        changes: autoTuneResult.changes.length,
        estHp: autoTuneResult.estimatedHp,
      });
      onConfigChange(autoTuneResult.config);
      setAutoTuneActive(true);
    }
  }, [autoTuneResult, onConfigChange]);

  // Revert auto-tune
  const revertAutoTune = useCallback(() => {
    onConfigChange(ecuConfig);
    setAutoTuneActive(false);
    setAutoTuneResult(null);
    log.info('panel', 'Auto-tune reverted');
  }, [ecuConfig, onConfigChange]);

  // Run auto-tune from manual inputs
  const runAutoTune = useCallback(() => {
    const val = parseFloat(autoTuneValue);
    if (isNaN(val)) return;
    const goal: AutoTuneGoal = {
      targetType: autoTuneTargetType,
      targetValue: val,
      constraints,
    };
    const result = autoTune(ecuConfig, goal);
    setAutoTuneResult(result);
  }, [ecuConfig, autoTuneTargetType, autoTuneValue, constraints]);

  // ── Minimized badge ────────────────────────────────────────────────
  if (minimized) {
    return (
      <div
        style={panelMinimized}
        onClick={() => setMinimized(false)}
        title="Open Command Panel (Search, AI, Auto-Tune)"
      >
        <div style={{
          background: 'rgba(10, 10, 26, 0.92)',
          border: '1px solid rgba(163, 230, 53, 0.3)',
          borderRadius: 8,
          padding: '6px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontSize: 11,
          boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
          backdropFilter: 'blur(8px)',
        }}>
          <span style={{ fontSize: 14 }}>🔍</span>
          <span style={{ color: '#a3e635', fontWeight: 600 }}>CMD</span>
          {autoTuneActive && (
            <span style={{
              background: '#a3e635',
              color: '#111',
              padding: '1px 6px',
              borderRadius: 4,
              fontSize: 9,
              fontWeight: 700,
            }}>AUTO-TUNE ON</span>
          )}
        </div>
      </div>
    );
  }

  // ── Expanded panel ─────────────────────────────────────────────────
  return (
    <div style={panelExpanded}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 12px',
        borderBottom: '1px solid rgba(163, 230, 53, 0.15)',
      }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 14 }}>🔍</span>
          <span style={{ color: '#a3e635', fontWeight: 600, fontSize: 12 }}>COMMAND PANEL</span>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['search', 'autotune', 'logs'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                background: tab === t ? 'rgba(163, 230, 53, 0.15)' : 'transparent',
                color: tab === t ? '#a3e635' : '#666',
                border: '1px solid ' + (tab === t ? 'rgba(163, 230, 53, 0.3)' : '#333'),
                borderRadius: 4,
                padding: '2px 8px',
                fontSize: 10,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {t === 'search' ? '🔎 Search' : t === 'autotune' ? '🎯 Tune' : '📋 Logs'}
            </button>
          ))}
          <button
            onClick={() => setMinimized(true)}
            style={{
              background: 'transparent',
              color: '#888',
              border: '1px solid #333',
              borderRadius: 4,
              padding: '2px 8px',
              fontSize: 12,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            ─
          </button>
        </div>
      </div>

      {/* Search / Command input */}
      <div style={{ padding: '8px 12px', borderBottom: '1px solid rgba(163, 230, 53, 0.08)' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            placeholder={tab === 'search' ? 'Search settings... or type a command' : 'e.g. "10 second quarter mile on pump gas"'}
            style={{
              flex: 1,
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid #333',
              borderRadius: 6,
              padding: '6px 10px',
              color: '#eee',
              fontSize: 11,
              fontFamily: 'inherit',
              outline: 'none',
            }}
          />
          <button
            onClick={handleSubmit}
            style={{
              background: 'rgba(163, 230, 53, 0.15)',
              color: '#a3e635',
              border: '1px solid rgba(163, 230, 53, 0.3)',
              borderRadius: 6,
              padding: '4px 10px',
              fontSize: 10,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            ⏎
          </button>
        </div>
        <div style={{ fontSize: 9, color: '#555', marginTop: 4 }}>
          💡 Try: "300hp turbo on pump gas" · "10s quarter mile" · "150 mph top speed"
        </div>
      </div>

      {/* Content area */}
      <div style={{ maxHeight: 'calc(80vh - 140px)', overflowY: 'auto', padding: '4px 0' }}>

        {/* ── SEARCH TAB ── */}
        {tab === 'search' && (
          <div>
            {searchResults.length === 0 && query.trim() && (
              <div style={{ padding: '20px 12px', textAlign: 'center', color: '#555' }}>
                No matching settings. Try a different search term.
              </div>
            )}
            {searchResults.length === 0 && !query.trim() && (
              <div style={{ padding: '12px', color: '#555', lineHeight: 1.6 }}>
                <div style={{ color: '#888', marginBottom: 8 }}>Start typing to search any setting:</div>
                <div>• <span style={{ color: '#a3e635' }}>boost</span> — turbo boost settings</div>
                <div>• <span style={{ color: '#a3e635' }}>gear</span> — gear ratios, final drive</div>
                <div>• <span style={{ color: '#a3e635' }}>fuel</span> — injectors, AFR, fuel type</div>
                <div>• <span style={{ color: '#a3e635' }}>vtec</span> — VTEC cam profiles</div>
                <div>• <span style={{ color: '#a3e635' }}>tire</span> — tires, grip, compound</div>
                <div style={{ marginTop: 8, color: '#666', fontSize: 10 }}>
                  Or type a command like "250hp all motor" and press Enter
                </div>
              </div>
            )}
            {searchResults.map(s => {
              const val = (ecuConfig as any)[s.key];
              const isEditing = editingKey === s.key;
              return (
                <div
                  key={s.key}
                  style={{
                    padding: '6px 12px',
                    borderBottom: '1px solid rgba(255,255,255,0.03)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    cursor: 'pointer',
                  }}
                  onClick={() => {
                    if (!isEditing) {
                      setEditingKey(s.key);
                      setEditValue(String(val));
                      onSettingNavigate?.(s.key);
                    }
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ color: '#ddd', fontSize: 11 }}>{s.label}</div>
                    <div style={{ color: '#555', fontSize: 9 }}>{s.category} · {s.key}</div>
                  </div>
                  {isEditing ? (
                    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                      {s.type === 'boolean' ? (
                        <select
                          value={String(val)}
                          onChange={e => handleSettingChange(s.key, e.target.value)}
                          style={{
                            background: '#1a1a2e',
                            color: '#eee',
                            border: '1px solid #a3e635',
                            borderRadius: 4,
                            padding: '2px 6px',
                            fontSize: 10,
                            fontFamily: 'inherit',
                          }}
                        >
                          <option value="true">true</option>
                          <option value="false">false</option>
                        </select>
                      ) : (
                        <input
                          autoFocus
                          value={editValue}
                          onChange={e => setEditValue(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') handleSettingChange(s.key, editValue);
                            if (e.key === 'Escape') setEditingKey(null);
                          }}
                          onBlur={() => handleSettingChange(s.key, editValue)}
                          style={{
                            width: 80,
                            background: '#1a1a2e',
                            color: '#eee',
                            border: '1px solid #a3e635',
                            borderRadius: 4,
                            padding: '2px 6px',
                            fontSize: 10,
                            fontFamily: 'inherit',
                            outline: 'none',
                          }}
                        />
                      )}
                    </div>
                  ) : (
                    <span style={{
                      color: typeof val === 'boolean' ? (val ? '#a3e635' : '#666') : '#4ade80',
                      fontSize: 10,
                      fontWeight: 600,
                      minWidth: 60,
                      textAlign: 'right',
                    }}>
                      {typeof val === 'boolean' ? (val ? 'ON' : 'OFF') : String(val).slice(0, 20)}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── AUTO-TUNE TAB ── */}
        {tab === 'autotune' && (
          <div style={{ padding: '8px 12px' }}>
            {/* Target selection */}
            <div style={{ marginBottom: 8 }}>
              <div style={{ color: '#888', fontSize: 10, marginBottom: 4 }}>TARGET</div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {([
                  ['quarter_mile', '1/4 Mile (s)'],
                  ['horsepower', 'HP'],
                  ['torque', 'Torque (ft-lb)'],
                  ['top_speed', 'Top Speed (MPH)'],
                ] as [TargetType, string][]).map(([type, label]) => (
                  <button
                    key={type}
                    onClick={() => setAutoTuneTargetType(type)}
                    style={{
                      background: autoTuneTargetType === type ? 'rgba(163, 230, 53, 0.2)' : 'rgba(255,255,255,0.03)',
                      color: autoTuneTargetType === type ? '#a3e635' : '#888',
                      border: '1px solid ' + (autoTuneTargetType === type ? 'rgba(163, 230, 53, 0.4)' : '#333'),
                      borderRadius: 4,
                      padding: '3px 8px',
                      fontSize: 10,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Target value */}
            <div style={{ marginBottom: 8, display: 'flex', gap: 6, alignItems: 'center' }}>
              <input
                value={autoTuneValue}
                onChange={e => setAutoTuneValue(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && runAutoTune()}
                style={{
                  width: 100,
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid #444',
                  borderRadius: 4,
                  padding: '4px 8px',
                  color: '#eee',
                  fontSize: 14,
                  fontFamily: 'inherit',
                  fontWeight: 700,
                  textAlign: 'center',
                }}
              />
              <span style={{ color: '#666', fontSize: 10 }}>
                {autoTuneTargetType === 'quarter_mile' ? 'seconds' :
                 autoTuneTargetType === 'horsepower' ? 'HP' :
                 autoTuneTargetType === 'torque' ? 'ft-lb' : 'MPH'}
              </span>
              <button
                onClick={runAutoTune}
                style={{
                  background: '#a3e635',
                  color: '#111',
                  border: 'none',
                  borderRadius: 6,
                  padding: '4px 14px',
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  marginLeft: 'auto',
                }}
              >
                🎯 CALCULATE
              </button>
            </div>

            {/* Constraints */}
            <div style={{ marginBottom: 8 }}>
              <div style={{ color: '#888', fontSize: 10, marginBottom: 4 }}>CONSTRAINTS</div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {([
                  ['pumpGasOnly', '⛽ Pump Gas'],
                  ['nitrousAllowed', '💨 Nitrous'],
                  ['turboAllowed', '🌀 Turbo'],
                  ['allMotor', '🔧 All Motor'],
                  ['streetLegal', '🛣️ Street Legal'],
                  ['tireDragSlick', '🏁 Drag Slicks'],
                ] as [keyof AutoTuneConstraints, string][]).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setConstraints(prev => ({ ...prev, [key]: !prev[key] }))}
                    style={{
                      background: constraints[key] ? 'rgba(163, 230, 53, 0.15)' : 'rgba(255,255,255,0.03)',
                      color: constraints[key] ? '#a3e635' : '#666',
                      border: '1px solid ' + (constraints[key] ? 'rgba(163, 230, 53, 0.3)' : '#333'),
                      borderRadius: 4,
                      padding: '2px 8px',
                      fontSize: 9,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Results */}
            {autoTuneResult && (
              <div style={{
                background: 'rgba(255,255,255,0.03)',
                borderRadius: 8,
                padding: 10,
                marginTop: 8,
              }}>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 6,
                  marginBottom: 8,
                }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: '#a3e635' }}>
                      {autoTuneResult.estimatedHp}
                    </div>
                    <div style={{ fontSize: 9, color: '#666' }}>EST. HP</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: '#4ade80' }}>
                      {autoTuneResult.estimatedTorque}
                    </div>
                    <div style={{ fontSize: 9, color: '#666' }}>EST. FT-LB</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: '#38bdf8' }}>
                      {autoTuneResult.estimatedQuarterMile}s
                    </div>
                    <div style={{ fontSize: 9, color: '#666' }}>EST. 1/4 MILE</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: '#c084fc' }}>
                      {autoTuneResult.estimatedTopSpeed}
                    </div>
                    <div style={{ fontSize: 9, color: '#666' }}>EST. TOP MPH</div>
                  </div>
                </div>

                {/* Changes list */}
                <div style={{ fontSize: 9, color: '#888', marginBottom: 6 }}>
                  {autoTuneResult.changes.length} changes · {autoTuneResult.feasible ? '✅ Feasible' : '⚠️ May not reach target'}
                </div>

                <div style={{ maxHeight: 120, overflowY: 'auto', marginBottom: 8 }}>
                  {autoTuneResult.changes.slice(0, 30).map((ch, i) => (
                    <div key={i} style={{
                      fontSize: 9,
                      padding: '2px 0',
                      borderBottom: '1px solid rgba(255,255,255,0.03)',
                      display: 'flex',
                      justifyContent: 'space-between',
                    }}>
                      <span style={{ color: '#4ade80' }}>{ch.field}</span>
                      <span style={{ color: '#666' }}>{String(ch.from).slice(0, 10)} → <span style={{ color: '#a3e635' }}>{String(ch.to).slice(0, 10)}</span></span>
                    </div>
                  ))}
                </div>

                {/* Notes */}
                {autoTuneResult.notes.map((note, i) => (
                  <div key={i} style={{ fontSize: 9, color: note.startsWith('⚠') ? '#fbbf24' : '#888', marginBottom: 2 }}>
                    {note}
                  </div>
                ))}

                {/* Action buttons */}
                <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                  <button
                    onClick={applyAutoTune}
                    style={{
                      flex: 1,
                      background: '#a3e635',
                      color: '#111',
                      border: 'none',
                      borderRadius: 6,
                      padding: '6px 0',
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    ✅ APPLY ALL CHANGES
                  </button>
                  {autoTuneActive && (
                    <button
                      onClick={revertAutoTune}
                      style={{
                        background: 'rgba(239, 68, 68, 0.15)',
                        color: '#ef4444',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        borderRadius: 6,
                        padding: '6px 10px',
                        fontSize: 10,
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                      }}
                    >
                      ↩ Revert
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── LOGS TAB ── */}
        {tab === 'logs' && (
          <div style={{ padding: '4px 0' }}>
            {logEntries.length === 0 && (
              <div style={{ padding: 20, textAlign: 'center', color: '#555' }}>No log entries yet.</div>
            )}
            {logEntries.map((entry, i) => (
              <div key={i} style={{
                padding: '2px 12px',
                fontSize: 9,
                fontFamily: "'JetBrains Mono', monospace",
                borderBottom: '1px solid rgba(255,255,255,0.02)',
                color: entry.level === 'error' ? '#ef4444' :
                       entry.level === 'warn' ? '#fbbf24' :
                       entry.level === 'info' ? '#4ade80' : '#666',
              }}>
                <span style={{ color: '#444' }}>{entry.iso.slice(11, 23)}</span>
                {' '}
                <span style={{ color: '#888' }}>[{entry.module}]</span>
                {' '}
                {entry.message}
              </div>
            ))}
            <div ref={logEndRef} />
          </div>
        )}
      </div>
    </div>
  );
}
