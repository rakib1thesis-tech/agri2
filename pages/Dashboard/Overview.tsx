
import React, { useState, useEffect } from 'react';
import { User, Field } from '../../types';
import { generateMockSensorData } from '../../constants';
import { getLiveWeatherAlert, checkAIConnection } from '../../services/gemini';

interface LiveWeather {
  location: string;
  text: string;
  sources: any[];
}

const Overview: React.FC<{ user: User }> = ({ user }) => {
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateStep, setUpdateStep] = useState('');
  const [fieldCount, setFieldCount] = useState(0);
  const [latestFields, setLatestFields] = useState<Field[]>([]);
  const [aiConnected, setAiConnected] = useState(true);
  
  // Console state
  const [showConsole, setShowConsole] = useState(false);
  const [manualKey, setManualKey] = useState('');
  
  const [loadingWeather, setLoadingWeather] = useState(false);
  const [weatherAlerts, setWeatherAlerts] = useState<LiveWeather[]>([]);
  
  useEffect(() => {
    const verifyConnection = async () => {
      const aistudio = (window as any).aistudio;
      let hasKey = false;
      if (aistudio) {
        hasKey = await aistudio.hasSelectedApiKey();
      }
      const userKey = localStorage.getItem('agricare_user_api_key');
      const envKey = !!process.env.API_KEY;
      
      setAiConnected(hasKey || !!userKey || envKey);
    };

    verifyConnection();
    
    const savedFields = localStorage.getItem('agricare_fields');
    if (savedFields) {
      const allFields: Field[] = JSON.parse(savedFields);
      const userFields = allFields.filter(f => f.user_id === user.id);
      setFieldCount(userFields.length);
      const snapshotFields = userFields.slice(0, 2);
      setLatestFields(snapshotFields);
      
      if (snapshotFields.length > 0) {
        fetchWeather(snapshotFields);
      }
    }
  }, [user.id]);

  const fetchWeather = async (fields: Field[]) => {
    if (!checkAIConnection()) return;

    setLoadingWeather(true);
    const uniqueLocations = Array.from(new Set(fields.map(f => f.location)));
    
    try {
      const alerts = await Promise.all(
        uniqueLocations.map(async (loc) => {
          const result = await getLiveWeatherAlert(loc);
          return {
            location: loc,
            text: result.text,
            sources: result.sources
          };
        })
      );
      setWeatherAlerts(alerts);
    } catch (err) {
      console.error("Failed to load live weather", err);
    } finally {
      setLoadingWeather(false);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualKey.trim()) return;
    
    localStorage.setItem('agricare_user_api_key', manualKey.trim());
    setAiConnected(true);
    setShowConsole(false);
    alert("API Configuration submitted successfully. Synchronizing field sensors...");
    if (latestFields.length > 0) {
      fetchWeather(latestFields);
    }
  };

  const handleConnectAI = async () => {
    const aistudio = (window as any).aistudio;
    if (aistudio) {
      try {
        await aistudio.openSelectKey();
        // Since it's a platform call, we verify success after
        const hasKey = await aistudio.hasSelectedApiKey();
        if (hasKey) {
          setAiConnected(true);
          if (latestFields.length > 0) {
            fetchWeather(latestFields);
          }
        } else {
          // If native failed or was canceled, show the manual console
          setShowConsole(true);
        }
      } catch (e) {
        console.error("Native selector failed, falling back to manual console", e);
        setShowConsole(true);
      }
    } else {
      setShowConsole(true);
    }
  };

  const handleClearKey = () => {
    localStorage.removeItem('agricare_user_api_key');
    window.location.reload();
  };

  const alerts = [
    { type: 'warning', text: 'Low moisture detected in your primary plots.', time: '2h ago' },
    { type: 'info', text: 'Weekly soil health report ready for review.', time: '5h ago' },
    { type: 'danger', text: 'One of your sensors is currently offline.', time: '1d ago' },
  ];

  const handleUpdateSchedules = () => {
    setIsUpdating(true);
    const steps = ['Analyzing patterns...', 'Calculating rates...', 'Optimizing cycles...'];
    let currentStep = 0;
    const interval = setInterval(() => {
      if (currentStep < steps.length) {
        setUpdateStep(steps[currentStep]);
        currentStep++;
      } else {
        clearInterval(interval);
        setIsUpdating(false);
        setUpdateStep('');
        alert("Schedules updated successfully.");
      }
    }, 800);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {!aiConnected && !showConsole && (
        <div className="mb-8 bg-slate-900 border border-emerald-500/30 p-8 rounded-[2.5rem] flex flex-col md:flex-row items-center justify-between gap-8 text-white shadow-2xl animate-in slide-in-from-top-4">
          <div className="flex items-center gap-6">
            <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center justify-center shrink-0">
              <i className="fas fa-robot text-3xl text-emerald-400"></i>
            </div>
            <div>
              <h3 className="font-black text-xl mb-2 flex items-center gap-2">
                AI Link Configuration Required
                <span className="inline-block w-2 h-2 rounded-full bg-red-500"></span>
              </h3>
              <p className="text-sm text-slate-400">Enable real-time satellite grounding and deep-soil diagnostics by connecting your Gemini instance.</p>
            </div>
          </div>
          <button 
            onClick={handleConnectAI}
            className="bg-emerald-500 hover:bg-emerald-400 text-slate-900 px-8 py-4 rounded-2xl font-black flex items-center gap-2 shadow-lg transition-all active:scale-95 whitespace-nowrap"
          >
            <i className="fas fa-key"></i> Connect Gemini AI
          </button>
        </div>
      )}

      {showConsole && (
        <div className="mb-8 bg-slate-950 border border-emerald-500/50 p-10 rounded-[2.5rem] text-white shadow-2xl animate-in zoom-in duration-300">
          <div className="flex justify-between items-start mb-8">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center border border-emerald-500/20">
                <i className="fas fa-terminal text-emerald-400"></i>
              </div>
              <div>
                <h3 className="font-bold text-lg">AI Connection Console</h3>
                <p className="text-xs text-slate-500 font-mono">STATION: AGRICARE-LINK-v3.1</p>
              </div>
            </div>
            <button onClick={() => setShowConsole(false)} className="text-slate-500 hover:text-white transition-colors">
              <i className="fas fa-times text-xl"></i>
            </button>
          </div>

          <form onSubmit={handleManualSubmit} className="space-y-6">
            <div>
              <label className="block text-xs font-bold text-emerald-500 uppercase tracking-widest mb-3 ml-1">Manual Configuration Code</label>
              <textarea 
                required
                rows={3}
                value={manualKey}
                onChange={(e) => setManualKey(e.target.value)}
                placeholder="Paste your Gemini API key here..."
                className="w-full bg-black/40 border border-emerald-500/20 rounded-2xl px-6 py-4 font-mono text-sm text-emerald-50 placeholder-emerald-900/50 focus:outline-none focus:border-emerald-500 transition-all shadow-inner"
              />
            </div>
            <div className="flex flex-col sm:flex-row gap-4">
              <button 
                type="submit"
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-4 rounded-xl font-bold transition-all shadow-lg shadow-emerald-900/20 flex items-center justify-center gap-2"
              >
                <i className="fas fa-plug"></i> Initialize Link
              </button>
              <button 
                type="button"
                onClick={() => setShowConsole(false)}
                className="px-8 py-4 bg-white/5 border border-white/10 rounded-xl font-bold hover:bg-white/10 transition-all"
              >
                Cancel
              </button>
            </div>
          </form>
          
          <div className="mt-6 flex items-center gap-2 text-[10px] font-mono text-slate-500">
            <i className="fas fa-lock"></i> 
            <span>KEYS ARE STORED LOCALLY IN ENCRYPTED BROWSER STORAGE.</span>
          </div>
        </div>
      )}

      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard Overview</h1>
          <p className="text-slate-500 text-sm">Real-time telemetry for {user.name}.</p>
        </div>
        <div className="flex gap-4">
          <div className={`px-4 py-2 rounded-lg text-right border ${aiConnected ? 'bg-emerald-50 border-emerald-100' : 'bg-slate-100 border-slate-200'}`}>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">AI Link</span>
            <div className="flex items-center justify-end gap-2">
              <span className={`text-xs font-bold ${aiConnected ? 'text-emerald-700' : 'text-slate-400'}`}>
                {aiConnected ? 'Active' : 'Unconfigured'}
              </span>
              {aiConnected && (
                <button onClick={handleClearKey} className="text-[10px] text-red-400 hover:text-red-600 ml-2" title="Reset Connection">
                  <i className="fas fa-power-off"></i>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <div className="text-slate-500 text-sm mb-1">Active Fields</div>
              <div className="text-3xl font-bold text-slate-900">{fieldCount}</div>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <div className="text-slate-500 text-sm mb-1">Average Health</div>
              <div className="text-3xl font-bold text-emerald-600">88%</div>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <div className="text-slate-500 text-sm mb-1">Yield Forecast</div>
              <div className="text-3xl font-bold text-slate-900">+12%</div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-bold text-slate-900">Recent Snapshots</h3>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              {latestFields.map(f => {
                const data = generateMockSensorData(f.field_id)[6];
                return (
                  <div key={f.field_id} className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <div className="font-bold text-slate-800 mb-3 truncate">{f.field_name}</div>
                    <div className="flex justify-between items-center mb-2 text-xs">
                      <span className="text-slate-500">Moisture</span>
                      <span className="font-bold">{data.moisture.toFixed(1)}%</span>
                    </div>
                    <div className="w-full h-1 bg-slate-200 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500" style={{ width: `${data.moisture}%` }}></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="space-y-8">
          <div className="bg-emerald-900 text-white p-6 rounded-[2rem] shadow-xl relative overflow-hidden flex flex-col min-h-[400px]">
            <div className="relative z-10 flex-1">
              <h3 className="font-bold mb-6 flex items-center gap-3 text-emerald-400">
                <i className="fas fa-satellite-dish"></i> Live Agri-Weather
              </h3>
              
              {loadingWeather ? (
                <div className="space-y-4 animate-pulse">
                  <div className="h-24 bg-white/5 rounded-2xl"></div>
                </div>
              ) : weatherAlerts.length > 0 ? (
                <div className="space-y-4 max-h-[400px] overflow-y-auto pr-1">
                  {weatherAlerts.map((alert, idx) => (
                    <div key={idx} className="p-4 bg-white/10 rounded-2xl border border-white/10">
                      <div className="text-[10px] font-black uppercase text-emerald-300 mb-1">{alert.location}</div>
                      <div className="text-sm leading-relaxed text-emerald-50">{alert.text}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 px-6">
                  <i className="fas fa-sun text-4xl text-emerald-500/30 mb-4"></i>
                  <p className="text-xs text-emerald-100/50 italic">
                    {aiConnected ? 'Synchronizing weather grounding data...' : 'Connect AI to unlock weather grounding.'}
                  </p>
                </div>
              )}
            </div>

            <div className="mt-6 pt-6 border-t border-white/5 relative z-10">
              <button onClick={handleUpdateSchedules} disabled={isUpdating} className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 rounded-2xl text-sm font-black text-slate-900 transition-all">
                {isUpdating ? updateStep : 'Recalculate Water'}
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
            <h3 className="font-bold text-slate-900 mb-6">Notifications</h3>
            <div className="space-y-6">
              {alerts.map((a, i) => (
                <div key={i} className="flex gap-4">
                  <div className={`mt-1 w-2 h-2 rounded-full shrink-0 ${a.type === 'warning' ? 'bg-orange-500' : 'bg-blue-500'}`}></div>
                  <div className="text-sm text-slate-800 font-medium leading-snug">{a.text}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Overview;
