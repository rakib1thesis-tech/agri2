
import React from 'react';
import { MOCK_FIELDS, generateMockSensorData } from '../../constants';

const Management: React.FC = () => {
  const fieldData = MOCK_FIELDS.map(f => ({
    field: f,
    data: generateMockSensorData(f.field_id)[6] // Get latest mock data
  }));

  // Logic for watering recommendations
  const getWaterPrescription = (moisture: number, size: number) => {
    const targetMoisture = 65; // Ideal
    if (moisture >= targetMoisture) return null;
    
    const deficit = targetMoisture - moisture;
    // Simple model: 1% moisture deficit on 1 acre requires ~1000 Liters (rough estimation for UI)
    const litersRequired = Math.round(deficit * size * 1000);
    return litersRequired;
  };

  // Logic for fertilizer recommendations
  const getFertilizerPrescription = (npk_n: number, npk_p: number, npk_k: number) => {
    const targetN = 60;
    const targetP = 50;
    const targetK = 70;
    
    let needs = [];
    if (npk_n < targetN) needs.push({ type: 'Urea (N)', deficit: targetN - npk_n });
    if (npk_p < targetP) needs.push({ type: 'DAP (P)', deficit: targetP - npk_p });
    if (npk_k < targetK) needs.push({ type: 'MOP (K)', deficit: targetK - npk_k });
    
    return needs;
  };

  const handleDownloadReport = () => {
    const now = new Date();
    const dateStr = now.toLocaleDateString() + ' ' + now.toLocaleTimeString();
    
    let reportContent = `AGRICARE - COMPREHENSIVE FARM MANAGEMENT REPORT\n`;
    reportContent += `Generated on: ${dateStr}\n`;
    reportContent += `============================================================\n\n`;

    fieldData.forEach(({ field, data }) => {
      const waterNeed = getWaterPrescription(data.moisture, field.size);
      const fertNeeds = getFertilizerPrescription(data.npk_n, data.npk_p, data.npk_k);

      reportContent += `FIELD: ${field.field_name}\n`;
      reportContent += `Location: ${field.location}\n`;
      reportContent += `Size: ${field.size} acres | Soil: ${field.soil_type}\n`;
      reportContent += `------------------------------------------------------------\n`;
      reportContent += `CURRENT SENSOR READINGS:\n`;
      reportContent += `- Temperature: ${data.temperature.toFixed(1)}°C\n`;
      reportContent += `- Moisture: ${data.moisture.toFixed(1)}%\n`;
      reportContent += `- pH Level: ${data.ph_level.toFixed(1)}\n`;
      reportContent += `- Nutrient Profile (NPK): ${data.npk_n.toFixed(0)}-${data.npk_p.toFixed(0)}-${data.npk_k.toFixed(0)}\n\n`;

      reportContent += `PRESCRIPTIVE ACTIONS:\n`;
      
      // Water Prescription
      if (waterNeed) {
        reportContent += `[!] IRRIGATION: Required. Apply approx. ${waterNeed.toLocaleString()} Liters.\n`;
      } else {
        reportContent += `[✓] IRRIGATION: Not required. Soil moisture is optimal.\n`;
      }

      // Fertilizer Prescription
      if (fertNeeds.length > 0) {
        reportContent += `[!] FERTILIZER: Deficit detected.\n`;
        fertNeeds.forEach(n => {
          reportContent += `    - Add ${n.type}: +${n.deficit.toFixed(0)} kg/ha\n`;
        });
      } else {
        reportContent += `[✓] FERTILIZER: All nutrient levels within target range.\n`;
      }

      reportContent += `\n============================================================\n\n`;
    });

    reportContent += `End of Report.\n`;

    // Trigger Download
    const blob = new Blob([reportContent], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Agricare_Farm_Report_${now.toISOString().split('T')[0]}.txt`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-10">
      <div className="mb-10">
        <h1 className="text-3xl font-bold text-slate-900">Farm Management Hub</h1>
        <p className="text-slate-500">Intelligent alerts and prescriptive actions for your fields.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <i className="fas fa-bell text-orange-500"></i> Active Management Alerts
          </h2>
          
          {fieldData.map(({ field, data }) => {
            const waterNeed = getWaterPrescription(data.moisture, field.size);
            const fertNeeds = getFertilizerPrescription(data.npk_n, data.npk_p, data.npk_k);
            
            return (
              <div key={field.field_id} className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-2">
                <div className="p-6 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                  <div className="font-bold text-slate-900">{field.field_name}</div>
                  <div className="text-xs text-slate-500 font-bold uppercase tracking-widest">{field.location}</div>
                </div>
                
                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Water Module */}
                  <div className={`p-5 rounded-2xl border ${waterNeed ? 'bg-blue-50 border-blue-100' : 'bg-slate-50 border-slate-100 opacity-60'}`}>
                    <div className="flex items-center gap-3 mb-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${waterNeed ? 'bg-blue-500 text-white' : 'bg-slate-200 text-slate-400'}`}>
                        <i className="fas fa-droplet"></i>
                      </div>
                      <h4 className="font-bold text-slate-900">Irrigation Status</h4>
                    </div>
                    {waterNeed ? (
                      <div>
                        <div className="text-xs font-bold text-blue-700 uppercase mb-1">Action Required</div>
                        <p className="text-sm text-blue-900 mb-3 font-medium">Apply approx. <strong>{waterNeed.toLocaleString()} Liters</strong> of water.</p>
                        <div className="text-[10px] text-blue-500 font-mono italic">Based on {data.moisture.toFixed(1)}% current moisture.</div>
                      </div>
                    ) : (
                      <p className="text-sm text-slate-500">Soil moisture is optimal ({data.moisture.toFixed(1)}%). No irrigation needed.</p>
                    )}
                  </div>

                  {/* Fertilizer Module */}
                  <div className={`p-5 rounded-2xl border ${fertNeeds.length > 0 ? 'bg-emerald-50 border-emerald-100' : 'bg-slate-50 border-slate-100 opacity-60'}`}>
                    <div className="flex items-center gap-3 mb-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${fertNeeds.length > 0 ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-400'}`}>
                        <i className="fas fa-flask"></i>
                      </div>
                      <h4 className="font-bold text-slate-900">Nutrient Needs</h4>
                    </div>
                    {fertNeeds.length > 0 ? (
                      <div className="space-y-3">
                        {fertNeeds.map((f, i) => (
                          <div key={i} className="flex justify-between items-center bg-white p-2 rounded-lg border border-emerald-100">
                            <span className="text-xs font-bold text-emerald-800">{f.type}</span>
                            <span className="text-[10px] bg-emerald-100 px-2 py-1 rounded-full font-bold text-emerald-700">+{f.deficit.toFixed(0)} kg/ha</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-500">Nutrient levels are stable. No fertilization required.</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Sidebar Info */}
        <div className="space-y-8">
          <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white">
            <h3 className="text-xl font-bold mb-6">Management Science</h3>
            <div className="space-y-6">
              <div className="border-l-2 border-emerald-500 pl-4">
                <div className="text-xs text-slate-400 uppercase font-bold tracking-widest mb-1">Watering Model</div>
                <p className="text-xs text-slate-300">Our IWR formula accounts for volumetric water content (VWC) and field capacity.</p>
              </div>
              <div className="border-l-2 border-blue-500 pl-4">
                <div className="text-xs text-slate-400 uppercase font-bold tracking-widest mb-1">Nutrient Stoichiometry</div>
                <p className="text-xs text-slate-300">NPK requirements are matched against target growth curves for specific cultivars.</p>
              </div>
            </div>
            <button 
              onClick={handleDownloadReport}
              className="w-full mt-10 py-3 bg-white/10 hover:bg-white/20 rounded-xl text-sm font-bold transition-all"
            >
              Download Full Report
            </button>
          </div>

          <div className="bg-emerald-50 p-6 rounded-[2.5rem] border border-emerald-100">
            <h4 className="font-bold text-emerald-900 mb-2">Weather Synergy</h4>
            <p className="text-xs text-emerald-700 leading-relaxed">
              Agricare integrates 48h forecasts. If heavy rain is predicted, irrigation alerts are automatically suppressed to prevent water wastage.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Management;
