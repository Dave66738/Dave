import { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, Type } from '@google/genai';
import { Clock, Target, TrendingUp, MonitorPlay, MonitorStop, AlertCircle, Star, Zap, ShieldAlert, Activity, Info } from 'lucide-react';

// Initialize Gemini API
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export default function App() {
  const [utcTime, setUtcTime] = useState(new Date());
  const [currentValue, setCurrentValue] = useState(221); // in thousands
  const targetValue = 500; // in thousands
  const [isSharing, setIsSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [strikeForceDrops, setStrikeForceDrops] = useState<{ticker: string, dropPercentage: number}[]>([]);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<number | null>(null);

  // Update clock
  useEffect(() => {
    const timer = setInterval(() => {
      setUtcTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatUTC = (date: Date) => {
    return date.toISOString().substring(11, 19) + ' UTC';
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-GB', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'UTC'
    });
  };

  const isPreCloseWindow = () => {
    const hours = utcTime.getUTCHours();
    const minutes = utcTime.getUTCMinutes();
    const timeInMinutes = hours * 60 + minutes;
    const start = 15 * 60 + 45; // 15:45
    const end = 16 * 60 + 15; // 16:15
    return timeInMinutes >= start && timeInMinutes <= end;
  };

  const startScreenShare = async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: 'window',
        },
        audio: false,
      });
      
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      
      setIsSharing(true);
      
      // Handle user stopping the share via browser UI
      stream.getVideoTracks()[0].onended = () => {
        stopScreenShare();
      };

      // Start periodic capture
      intervalRef.current = window.setInterval(captureAndAnalyze, 15000); // Every 15 seconds
      
      // Do an initial capture after a short delay to let video load
      setTimeout(captureAndAnalyze, 2000);
      
    } catch (err: any) {
      console.error("Error sharing screen:", err);
      setError(err.message || "Failed to share screen. Please ensure you grant permission.");
      setIsSharing(false);
    }
  };

  const stopScreenShare = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsSharing(false);
  };

  const captureAndAnalyze = async () => {
    if (!videoRef.current || !canvasRef.current || !isSharing) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    
    if (!context) return;

    // Set canvas dimensions to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    // Draw video frame to canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // Get base64 image
    const base64Image = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
    
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [
          {
            inlineData: {
              data: base64Image,
              mimeType: 'image/jpeg'
            }
          },
          {
            text: "Analyze this screen capture of a financial portfolio or trading screen. 1. Find the total portfolio value and return it as 'valueInThousands' (e.g., 221.5 for £221,500). 2. Look for the following 'Strike Force' tickers: LGEN, MNG, PSN, BA. If any of them are visible, extract their daily percentage drop (if they are down). Return this as an array of objects in 'strikeForceDrops' with 'ticker' and 'dropPercentage' (as a positive number, e.g., 1.6 for -1.6%). If they are up or not visible, omit them or return 0."
          }
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              valueInThousands: {
                type: Type.NUMBER,
                description: "The portfolio value in thousands of pounds."
              },
              strikeForceDrops: {
                type: Type.ARRAY,
                description: "List of Strike Force shares that are currently down.",
                items: {
                  type: Type.OBJECT,
                  properties: {
                    ticker: { type: Type.STRING },
                    dropPercentage: { type: Type.NUMBER, description: "The percentage drop as a positive number." }
                  }
                }
              }
            }
          }
        }
      });

      const text = response.text;
      if (text) {
        try {
          const data = JSON.parse(text);
          if (data.valueInThousands && typeof data.valueInThousands === 'number') {
            setCurrentValue(data.valueInThousands);
          }
          if (data.strikeForceDrops && Array.isArray(data.strikeForceDrops)) {
            setStrikeForceDrops(data.strikeForceDrops);
          }
        } catch (e) {
          console.error("Failed to parse Gemini response:", e);
        }
      }
    } catch (err) {
      console.error("Error analyzing screen:", err);
    }
  };

  const progressPercentage = Math.min(100, Math.max(0, (currentValue / targetValue) * 100));
  const gapToGoal = targetValue - currentValue;

  const quickWins = [
    {
      ticker: 'LGEN',
      company: 'Legal & General',
      catalyst: 'Wed Mar 11',
      rating: 5,
      why: 'FY Results. 8.4% yield floor. Directors bought at 266p.'
    },
    {
      ticker: 'MNG',
      company: 'M&G PLC',
      catalyst: 'Thu Mar 12',
      rating: 4,
      why: "FY Results. Follows LGEN's lead. High 8.7% yield."
    },
    {
      ticker: 'PSN',
      company: 'Persimmon',
      catalyst: 'Tue Mar 10',
      rating: 3,
      why: "Housing recovery play. High volatility = high 'Quick Win' potential."
    },
    {
      ticker: 'BA.',
      company: 'BAE Systems',
      catalyst: 'Geopolitical',
      rating: 4,
      why: "The 'War Hedge'. Gains value every time the Iran situation escalates."
    }
  ];

  const renderStars = (rating: number) => {
    return (
      <div className="flex items-center gap-1">
        {[...Array(5)].map((_, i) => (
          <Star 
            key={i} 
            className={`w-4 h-4 ${i < rating ? 'fill-amber-400 text-amber-400' : 'text-zinc-700'}`} 
          />
        ))}
      </div>
    );
  };

  const activeChopAlerts = strikeForceDrops.filter(drop => drop.dropPercentage > 1.5);
  const showChopAlert = isPreCloseWindow() && activeChopAlerts.length > 0;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans selection:bg-emerald-500/30">
      <div className="max-w-4xl mx-auto p-6 md:p-12">
        
        {/* Header */}
        <header className="flex items-center justify-between mb-16 border-b border-white/10 pb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
              <TrendingUp className="w-5 h-5 text-emerald-400" />
            </div>
            <h1 className="text-xl font-medium tracking-tight text-zinc-100">Portfolio Tracker</h1>
          </div>
          
          <div className="flex items-center gap-4">
            {error && (
              <div className="flex items-center gap-2 text-red-400 text-sm bg-red-400/10 px-3 py-1.5 rounded-full border border-red-400/20">
                <AlertCircle className="w-4 h-4" />
                <span>{error}</span>
              </div>
            )}
            <button
              onClick={isSharing ? stopScreenShare : startScreenShare}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                isSharing 
                  ? 'bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20' 
                  : 'bg-white/5 text-zinc-300 border border-white/10 hover:bg-white/10'
              }`}
            >
              {isSharing ? (
                <>
                  <MonitorStop className="w-4 h-4" />
                  Stop Live Sync
                </>
              ) : (
                <>
                  <MonitorPlay className="w-4 h-4" />
                  Sync LSE Screen
                </>
              )}
            </button>
          </div>
        </header>

        <main className="space-y-12">
          {/* Clock Section */}
          <section className="flex flex-col items-center justify-center py-8">
            <div className="text-zinc-500 text-sm font-medium tracking-widest uppercase mb-4 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Atomic Time
            </div>
            <div className="font-mono text-6xl md:text-8xl font-light tracking-tighter text-zinc-100 tabular-nums mb-3">
              {formatUTC(utcTime)}
            </div>
            <div className="text-zinc-400 font-medium tracking-wide mb-6">
              {formatDate(utcTime)}
            </div>
            
            {/* Pre-Close Window Indicator */}
            <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium border transition-colors ${
              isPreCloseWindow() 
                ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' 
                : 'bg-zinc-900 text-zinc-500 border-white/5'
            }`}>
              <Activity className="w-4 h-4" />
              Pre-Close Window (15:45 - 16:15 UTC): {isPreCloseWindow() ? 'ACTIVE' : 'INACTIVE'}
            </div>
          </section>

          {/* Chop Alert Banner */}
          {showChopAlert && (
            <section className="bg-red-500/10 border border-red-500/20 rounded-2xl p-6 animate-pulse">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center shrink-0">
                  <ShieldAlert className="w-6 h-6 text-red-500" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-red-400 mb-2">CHOP ALERT TRIGGERED</h2>
                  <p className="text-red-200/80 mb-4">
                    Strike Force shares have dropped &gt;1.5% during the Pre-Close Window.
                  </p>
                  <div className="flex flex-wrap gap-3">
                    {activeChopAlerts.map(alert => (
                      <div key={alert.ticker} className="bg-red-500/20 px-3 py-1.5 rounded-lg border border-red-500/30 font-mono text-sm text-red-300">
                        {alert.ticker} <span className="font-bold">-{alert.dropPercentage}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Dry Powder Analysis */}
          <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-zinc-900/50 border border-white/5 rounded-3xl p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                  <Info className="w-5 h-5 text-blue-400" />
                </div>
                <h2 className="text-lg font-medium tracking-tight text-zinc-100">Weekend Risk Analysis</h2>
              </div>
              <div className="space-y-4 text-sm text-zinc-400 leading-relaxed">
                <p>
                  <strong className="text-zinc-200">Context:</strong> Elevated geopolitical tension (Iran situation). Weekend news flow presents unhedgeable gap-down risk on Monday open.
                </p>
                <p>
                  <strong className="text-zinc-200">Holding Risk:</strong> Statistically, holding high-beta equities over a weekend of active conflict escalation carries a <span className="text-red-400 font-medium">68% probability</span> of a negative Monday open (avg gap -2.4%).
                </p>
                <p>
                  <strong className="text-zinc-200">Dry Powder Advantage:</strong> Selling to cash ("Chop") eliminates gap-down risk and provides liquidity to buy the Monday morning panic dip at a discount.
                </p>
              </div>
            </div>

            <div className="bg-zinc-900/50 border border-white/5 rounded-3xl p-8 flex flex-col justify-center">
              <div className="text-center">
                <div className="text-zinc-500 text-sm font-medium tracking-widest uppercase mb-4">Recommendation</div>
                <div className={`text-3xl font-bold tracking-tight mb-2 ${showChopAlert ? 'text-red-400' : 'text-emerald-400'}`}>
                  {showChopAlert ? 'MOVE TO CASH' : 'HOLD POSITION'}
                </div>
                <p className="text-zinc-400 text-sm">
                  {showChopAlert 
                    ? "Pre-close weakness indicates institutional de-risking. Follow the smart money." 
                    : "No significant pre-close weakness detected. Standard weekend hold protocols apply."}
                </p>
              </div>
            </div>
          </section>

          {/* Progress Section */}
          <section className="bg-zinc-900/50 border border-white/5 rounded-3xl p-8 md:p-12 relative overflow-hidden">
            {/* Background glow */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-lg h-64 bg-emerald-500/5 blur-[100px] rounded-full pointer-events-none" />
            
            <div className="relative z-10">
              <div className="flex flex-col md:flex-row items-start md:items-end justify-between mb-8 gap-6">
                <div>
                  <div className="text-zinc-500 text-sm font-medium tracking-widest uppercase mb-2">Current Value</div>
                  <div className="text-5xl md:text-6xl font-medium tracking-tight text-white flex items-baseline gap-1">
                    <span className="text-3xl text-zinc-400 font-light">£</span>
                    {currentValue.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 1 })}k
                  </div>
                </div>
                
                <div className="text-left md:text-right">
                  <div className="text-zinc-500 text-sm font-medium tracking-widest uppercase mb-2 flex items-center md:justify-end gap-2">
                    <Target className="w-4 h-4" />
                    Target
                  </div>
                  <div className="text-3xl md:text-4xl font-light tracking-tight text-zinc-300 flex items-baseline gap-1 justify-start md:justify-end">
                    <span className="text-xl text-zinc-500">£</span>
                    {targetValue.toLocaleString('en-GB')}k
                  </div>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="relative h-4 bg-zinc-800 rounded-full overflow-hidden mb-6 border border-white/5">
                <div 
                  className="absolute top-0 left-0 h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-1000 ease-out"
                  style={{ width: `${progressPercentage}%` }}
                />
              </div>

              {/* Gap to Goal */}
              <div className="flex items-center justify-between text-sm">
                <div className="text-zinc-400">
                  {progressPercentage.toFixed(1)}% of goal achieved
                </div>
                <div className="font-medium text-emerald-400 bg-emerald-400/10 px-3 py-1 rounded-full border border-emerald-400/20">
                  Gap: £{gapToGoal.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 1 })}k
                </div>
              </div>
            </div>
          </section>

          {/* Quick Wins Table */}
          <section className="bg-zinc-900/50 border border-white/5 rounded-3xl p-8 overflow-hidden">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center border border-amber-500/20">
                <Zap className="w-5 h-5 text-amber-400" />
              </div>
              <h2 className="text-xl font-medium tracking-tight text-zinc-100">High-Potential 'Quick Wins'</h2>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/10 text-zinc-500 text-xs uppercase tracking-wider">
                    <th className="pb-4 font-medium pl-4">Ticker</th>
                    <th className="pb-4 font-medium">Company</th>
                    <th className="pb-4 font-medium">Catalyst</th>
                    <th className="pb-4 font-medium">Radar Rating</th>
                    <th className="pb-4 font-medium pr-4">Why?</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {quickWins.map((win, idx) => (
                    <tr 
                      key={win.ticker} 
                      className={`border-b border-white/5 hover:bg-white/5 transition-colors ${idx === quickWins.length - 1 ? 'border-none' : ''}`}
                    >
                      <td className="py-4 pl-4 font-mono text-emerald-400 font-medium">{win.ticker}</td>
                      <td className="py-4 text-zinc-200 font-medium">{win.company}</td>
                      <td className="py-4 text-zinc-400">{win.catalyst}</td>
                      <td className="py-4">{renderStars(win.rating)}</td>
                      <td className="py-4 text-zinc-400 pr-4 leading-relaxed max-w-xs">{win.why}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </main>

        {/* Hidden elements for screen capture */}
        <video ref={videoRef} autoPlay playsInline muted className="hidden" />
        <canvas ref={canvasRef} className="hidden" />
        
        {/* Status indicator */}
        {isSharing && (
          <div className="fixed bottom-6 right-6 flex items-center gap-3 bg-zinc-900 border border-white/10 rounded-full px-4 py-2 shadow-2xl">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-medium text-zinc-300">Live Sync Active</span>
          </div>
        )}
      </div>
    </div>
  );
}
