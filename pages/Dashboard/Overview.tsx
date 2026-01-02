
import React, { useState, useEffect } from 'react';
import { User, Field } from '../../types';
import { MOCK_FIELDS, generateMockSensorData } from '../../constants';

const Overview: React.FC<{ user: User }> = ({ user }) => {
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateStep, setUpdateStep] = useState('');
  const [fieldCount, setFieldCount] = useState(MOCK_FIELDS.length);
  const [latestFields, setLatestFields] = useState<Field[]>(MOCK_FIELDS.slice(0, 2));
  
  useEffect(() => {
    const savedFields = localStorage.getItem('agricare_fields');
    if (savedFields) {
      const parsed = JSON.parse(savedFields);
      setFieldCount(parsed.length);
      setLatestFields(parsed.slice(0, 2));
    }
  }, []);

  const alerts = [
    { type: 'warning', text: 'Low moisture detected in your primary plots.', time: '2h ago' },
    { type: 'info', text: 'Weekly soil health report ready for review.', time: '5h ago' },
    { type: 'danger', text: 'One of your sensors is currently offline.', time: '1d ago' },
  ];

  const handleUpdateSchedules = () => {
    setIsUpdating(true);
    
    const steps = [
      'Analyzing recent weather patterns...',
      'Calculating evaporation rates...',
      'Optimizing irrigation cycles...',
      'Finalizing management plan...'
    ];

    let currentStep = 0;
    const interval = setInterval(() => {
      if (currentStep < steps.length) {
        setUpdateStep(steps[currentStep]);
        currentStep++;
      } else {
        clearInterval(interval);
        setIsUpdating(false);
        setUpdateStep('');
        alert("Success! Schedules updated based on the latest monsoon data. You can view the new prescriptions in the Management Hub.");
      }
    }, 800);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Welcome back, {user.name}</h1>
          <p className="text-slate-500 text-sm">Here's what's happening on your farm today.</p>
        </div>
        <div className="bg-emerald-50 border border-emerald-100 px-4 py-2 rounded-lg text-right">
          <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wider block">Subscription Plan</span>
          <span className="text-sm font-bold text-emerald-900 capitalize">{user.subscriptionPlan} • Active</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <div className="text-slate-500 text-sm mb-1">Active Fields</div>
              <div className="text-3xl font-bold text-slate-900">{fieldCount}</div>
              <div className="text-xs text-emerald-600 mt-2 font-medium">
                <i className="fas fa-chart-line mr-1"></i> Data-linked fields
              </div>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <div className="text-slate-500 text-sm mb-1">Average Health</div>
              <div className="text-3xl font-bold text-emerald-600">88%</div>
              <div className="text-xs text-slate-400 mt-2 font-medium">Optimal conditions</div>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <div className="text-slate-500 text-sm mb-1">Yield Forecast</div>
              <div className="text-3xl font-bold text-slate-900">+12%</div>
              <div className="text-xs text-emerald-600 mt-2 font-medium">Trending upwards</div>
            </div>
          </div>

          {/* Field Snapshot */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-bold text-slate-900">Recent Field Snapshots</h3>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              {latestFields.length > 0 ? latestFields.map(f => {
                const data = generateMockSensorData(f.field_id)[6];
                return (
                  <div key={f.field_id} className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <div className="font-bold text-slate-800 mb-3 truncate">{f.field_name}</div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs text-slate-500">Soil Moisture</span>
                      <span className="text-xs font-bold text-slate-900">{data.moisture.toFixed(1)}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500" style={{ width: `${data.moisture}%` }}></div>
                    </div>
                  </div>
                );
              }) : (
                <div className="col-span-2 text-center py-10 text-slate-400">
                   <p className="text-sm italic">No fields configured yet.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-8">
          {/* Weather Alerts */}
          <div className="bg-emerald-900 text-white p-6 rounded-2xl shadow-lg relative overflow-hidden">
            <div className="relative z-10">
              <h3 className="font-bold mb-4 flex items-center gap-2 text-emerald-400">
                <i className="fas fa-cloud-bolt"></i> Weather Alert
              </h3>
              <div className="p-4 bg-white/10 rounded-xl backdrop-blur-sm border border-white/10 mb-4">
                <div className="text-sm font-bold mb-1">Monsoon Rain Predicted</div>
                <div className="text-xs text-emerald-200">Expect heavy rainfall in the next 12h. Our AI recommends shifting irrigation cycles.</div>
              </div>
              <button 
                onClick={handleUpdateSchedules}
                disabled={isUpdating}
                className={`w-full py-3 rounded-xl text-sm font-bold transition-all flex flex-col items-center justify-center gap-1 ${
                  isUpdating ? 'bg-emerald-700 cursor-not-allowed' : 'bg-emerald-500 hover:bg-emerald-600 shadow-xl shadow-emerald-950/20'
                }`}
              >
                {isUpdating ? (
                  <>
                    <div className="flex items-center gap-2"><i className="fas fa-spinner fa-spin"></i> Optimizing...</div>
                    <div className="text-[10px] opacity-60 font-normal">{updateStep}</div>
                  </>
                ) : (
                  'Update Schedules'
                )}
              </button>
            </div>
            <i className="fas fa-cloud-rain absolute -bottom-4 -right-4 text-8xl text-white/5 pointer-events-none"></i>
          </div>

          {/* Activity Log */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
            <h3 className="font-bold text-slate-900 mb-6">Recent Notifications</h3>
            <div className="space-y-6">
              {alerts.map((a, i) => (
                <div key={i} className="flex gap-4">
                  <div className={`mt-1 w-2 h-2 rounded-full shrink-0 ${
                    a.type === 'warning' ? 'bg-orange-500' : a.type === 'danger' ? 'bg-red-500' : 'bg-blue-500'
                  }`}></div>
                  <div>
                    <div className="text-sm text-slate-800 font-medium leading-snug">{a.text}</div>
                    <div className="text-[10px] text-slate-400 mt-1 uppercase font-bold tracking-wider">{a.time}</div>
                  </div>
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
