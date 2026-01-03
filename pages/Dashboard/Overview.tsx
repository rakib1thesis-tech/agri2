
import React, { useState, useEffect } from 'react';
import { User, Field } from '../../types';
import { generateMockSensorData } from '../../constants';
import { getLiveWeatherAlert, checkAIConnection } from '../../services/gemini';
import { isFirebaseEnabled, saveFirebaseConfig, syncFields } from '../../services/db';

const Overview: React.FC<{ user: User }> = ({ user }) => {
  const [fieldCount, setFieldCount] = useState(0);
  const [latestFields, setLatestFields] = useState<Field[]>([]);
  const [aiConnected, setAiConnected] = useState(true);
  const [showFirebaseSetup, setShowFirebaseSetup] = useState(false);
  const [fbConfig, setFbConfig] = useState({ apiKey: "", authDomain: "", projectId: "", appId: "" });
  const [loadingWeather, setLoadingWeather] = useState(false);
  const [weatherAlerts, setWeatherAlerts] = useState<any[]>([]);

  // Effect to synchronize field data and connection status on mount
  useEffect(() => {
    const verify = async () => {
      // Check for AI connection status based on environment config
      setAiConnected(checkAIConnection());

      // Load fields for the user
      const fields = await syncFields(user.id);
      setFieldCount(fields.length);
      setLatestFields(fields.slice(0, 3));

      // Load weather for the first field if available
      if (fields.length > 0) {
        setLoadingWeather(true);
        const alert = await getLiveWeatherAlert(fields[0].location);
        setWeatherAlerts([alert]);
        setLoadingWeather(false);
      }
    };
    verify();
  }, [user.id]);

  const handleFirebaseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fbConfig.apiKey || !fbConfig.projectId) return;
    saveFirebaseConfig(fbConfig);
    setShowFirebaseSetup(false);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">স্বাগতম, {user.name}</h1>
          <p className="text-slate-500">Overview of your {fieldCount} agricultural fields today.</p>
        </div>
        {!isFirebaseEnabled() && (
          <button 
            onClick={() => setShowFirebaseSetup(true)}
            className="bg-emerald-50 text-emerald-700 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-emerald-100 transition-colors border border-emerald-100"
          >
            <i className="fas fa-cloud-upload-alt mr-2"></i> Enable Cloud Sync
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
          <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center mb-4">
            <i className="fas fa-map-location-dot"></i>
          </div>
          <div className="text-3xl font-bold text-slate-900">{fieldCount}</div>
          <div className="text-slate-500 text-sm font-medium">Fields Registered</div>
        </div>
        
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
          <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center mb-4">
            <i className="fas fa-microchip"></i>
          </div>
          <div className="text-3xl font-bold text-slate-900">{fieldCount * 3}</div>
          <div className="text-slate-500 text-sm font-medium">Virtual Sensors Active</div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
          <div className="w-10 h-10 bg-purple-100 text-purple-600 rounded-xl flex items-center justify-center mb-4">
            <i className="fas fa-robot"></i>
          </div>
          <div className="text-3xl font-bold text-slate-900">{aiConnected ? "Online" : "Limited"}</div>
          <div className="text-slate-500 text-sm font-medium">AI Diagnostic Engine</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-6">
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <i className="fas fa-satellite-dish text-emerald-600"></i> Agricultural Weather Alerts
          </h3>
          {loadingWeather ? (
            <div className="bg-white p-10 rounded-3xl border border-slate-100 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600 mx-auto"></div>
            </div>
          ) : weatherAlerts.length > 0 ? (
            weatherAlerts.map((alert, idx) => (
              <div key={idx} className="bg-white p-6 rounded-3xl border border-emerald-100 shadow-sm">
                <p className="text-slate-700 text-sm leading-relaxed mb-4">{alert.text}</p>
                {alert.sources.length > 0 && (
                  <div className="pt-3 border-t border-slate-50">
                    <div className="flex flex-wrap gap-2">
                      {alert.sources.map((src: any, i: number) => (
                        <a key={i} href={src.web?.uri} target="_blank" rel="noopener noreferrer" className="text-[10px] font-bold text-emerald-600 hover:underline flex items-center gap-1">
                          <i className="fas fa-link"></i> {src.web?.title || 'External Report'}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="bg-white p-10 rounded-3xl border border-slate-100 text-center text-slate-400 text-sm italic">
              No recent alerts for your locations.
            </div>
          )}
        </div>

        <div className="space-y-6">
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <i className="fas fa-clock-rotate-left text-emerald-600"></i> Recent Activity
          </h3>
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="divide-y divide-slate-50">
              {latestFields.map(field => (
                <div key={field.field_id} className="p-4 hover:bg-slate-50 transition-colors flex justify-between items-center">
                  <div>
                    <div className="font-bold text-slate-900 text-sm">{field.field_name}</div>
                    <div className="text-[10px] text-slate-500 font-medium">{field.location}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Synced</span>
                  </div>
                </div>
              ))}
              {latestFields.length === 0 && (
                <div className="p-10 text-center text-slate-400 text-sm italic">No field data found.</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {showFirebaseSetup && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-[2.5rem] w-full max-w-md p-8 shadow-2xl animate-in zoom-in duration-200">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Cloud Configuration</h2>
                <p className="text-xs text-slate-500">Connect to your Firebase project.</p>
              </div>
              <button onClick={() => setShowFirebaseSetup(false)} className="text-slate-400 hover:text-slate-600">
                <i className="fas fa-times text-xl"></i>
              </button>
            </div>
            <form onSubmit={handleFirebaseSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 ml-1">Firebase API Key</label>
                <input 
                  type="text" 
                  className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                  value={fbConfig.apiKey} onChange={e => setFbConfig({...fbConfig, apiKey: e.target.value})} 
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 ml-1">Project ID</label>
                  <input 
                    type="text" 
                    className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                    value={fbConfig.projectId} onChange={e => setFbConfig({...fbConfig, projectId: e.target.value})} 
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 ml-1">App ID</label>
                  <input 
                    type="text" 
                    className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                    value={fbConfig.appId} onChange={e => setFbConfig({...fbConfig, appId: e.target.value})} 
                  />
                </div>
              </div>
              <button type="submit" className="w-full py-4 mt-4 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 shadow-lg shadow-emerald-200 transition-all">
                Connect Firebase
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Overview;
