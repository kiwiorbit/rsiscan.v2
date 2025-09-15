

import React, { useRef, useEffect, useMemo, useState, useCallback } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Label, ReferenceArea } from 'recharts';
import * as htmlToImage from 'html-to-image';
import type { SymbolData, Settings, Timeframe, Drawing, DrawingTool, VolumeProfileData, HTFLevels } from '../types';
import DrawingToolbar from './DrawingToolbar';
import { calculateVolumeProfile } from '../services/volumeProfileService';
import { fetchHigherTimeframeLevels } from '../services/binanceService';

interface ModalProps {
    symbol: string;
    data: SymbolData;
    onClose: () => void;
    settings: Settings;
    timeframe: Timeframe;
    onSwitchToRsiChart: () => void;
    onSwitchToStochChart: () => void;
}

const BRUSH_SIZE = 3;

// Helper function to get accurate canvas coordinates from mouse or touch events
const getEventCoordinates = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>): { x: number; y: number } | null => {
    const canvas = e.currentTarget;
    const rect = canvas.getBoundingClientRect();

    let clientX, clientY;

    if ('touches' in e) { // Touch event
        const touch = e.touches[0] || e.changedTouches[0];
        if (!touch) return null;
        clientX = touch.clientX;
        clientY = touch.clientY;
    } else { // Mouse event
        clientX = e.clientX;
        clientY = e.clientY;
    }

    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY,
    };
};

const embedFontsInCss = async (url: string): Promise<string> => {
    try {
        const cssText = await fetch(url).then(res => res.text());
        const fontUrls = cssText.match(/url\(https?:\/\/[^)]+\)/g) || [];

        const fontPromises = fontUrls.map(async (fontUrlMatch) => {
            const fontUrl = fontUrlMatch.replace(/url\((['"])?(.*?)\1\)/, '$2');
            const response = await fetch(fontUrl);
            if (!response.ok) {
                throw new Error(`Failed to fetch font: ${response.statusText}`);
            }
            const blob = await response.blob();
            return new Promise<[string, string]>((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => {
                    resolve([fontUrlMatch, reader.result as string]);
                };
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
        });

        const fontData = await Promise.all(fontPromises);
        let newCssText = cssText;
        fontData.forEach(([url, dataUrl]) => {
            newCssText = newCssText.replace(url, `url(${dataUrl})`);
        });

        return newCssText;
    } catch (error) {
        console.error('Failed to embed fonts:', error);
        return '';
    }
};

const PriceDetailModal: React.FC<ModalProps> = ({ symbol, data, onClose, settings, timeframe, onSwitchToRsiChart, onSwitchToStochChart }) => {
    const modalRef = useRef<HTMLDivElement>(null);
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const chartAreaRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    
    // Drawing state
    const [drawings, setDrawings] = useState<Drawing[]>([]);
    const [activeTool, setActiveTool] = useState<DrawingTool>('trendline');
    const [brushColor, setBrushColor] = useState(settings.textColor);

    const [showVolumeProfile, setShowVolumeProfile] = useState(false);
    const [showGoldenPocket, setShowGoldenPocket] = useState(false);
    const [isCopied, setIsCopied] = useState(false);

    // New state for HTF levels
    const [showHtfLevels, setShowHtfLevels] = useState(false);
    const [htfLevels, setHtfLevels] = useState<HTFLevels | null>(null);
    const [isLoadingHtfLevels, setIsLoadingHtfLevels] = useState(false);

    const isDrawingRef = useRef(false);
    const currentPathRef = useRef<Drawing | null>(null);
    const canvasSnapshotRef = useRef<ImageData | null>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
                onClose();
            }
        };
        const handleEscKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleEscKey);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleEscKey);
        };
    }, [onClose]);

    // Reset brush color if theme changes
    useEffect(() => {
        setBrushColor(settings.textColor);
    }, [settings.textColor]);

    // Lazy load HTF data when toggled
    useEffect(() => {
        if (showHtfLevels && !htfLevels && !isLoadingHtfLevels) {
            setIsLoadingHtfLevels(true);
            fetchHigherTimeframeLevels(symbol)
                .then(setHtfLevels)
                .catch(console.error)
                .finally(() => setIsLoadingHtfLevels(false));
        }
    }, [showHtfLevels, htfLevels, isLoadingHtfLevels, symbol]);

    const chartData = useMemo(() => {
        return data?.klines || [];
    }, [data]);
    
    const volumeProfileData: VolumeProfileData | null = useMemo(() => {
        if (!data?.klines || data.klines.length === 0) return null;
        return calculateVolumeProfile(data.klines, 100); // High resolution volume profile
    }, [data?.klines]);
    
    const goldenPocketLevels = useMemo(() => {
        if (!chartData || chartData.length < 2) return null;

        const highs = chartData.map(k => k.high);
        const lows = chartData.map(k => k.low);

        const highestHigh = Math.max(...highs);
        const lowestLow = Math.min(...lows);
        const range = highestHigh - lowestLow;

        if (range === 0) return null;
        
        const isUptrend = chartData[chartData.length - 1].close > chartData[0].close;

        let top, bottom;
        if (isUptrend) {
            top = highestHigh - (range * 0.618);
            bottom = highestHigh - (range * 0.65);
        } else {
            top = lowestLow + (range * 0.65);
            bottom = lowestLow + (range * 0.618);
        }

        return { top, bottom };
    }, [chartData]);

    const handleCapture = useCallback(async () => {
        if (!modalRef.current || isCopied) return;

        const style = document.createElement('style');
        document.head.appendChild(style);

        try {
            const fontAwesomeCss = await embedFontsInCss('https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css');
            const googleFontsCss = await embedFontsInCss('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
            style.appendChild(document.createTextNode(fontAwesomeCss + googleFontsCss));

            const blobOptions = {
                backgroundColor: document.documentElement.classList.contains('dark') ? settings.bgColor : settings.bgColor,
                filter: (node: Node): boolean => {
                    if (node instanceof HTMLLinkElement && (node.href.includes('fonts.googleapis.com') || node.href.includes('cdnjs.cloudflare.com'))) {
                        return false;
                    }
                    return true;
                },
            };
            const blob = await htmlToImage.toBlob(modalRef.current, blobOptions);
            if (!blob) throw new Error('Failed to generate image blob.');
            await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
            setIsCopied(true);
            setTimeout(() => setIsCopied(false), 2000);
            
        } catch (error) {
            console.error(`Failed to copy image:`, error);
            alert(`Could not copy chart image.`);
        } finally {
            if (document.head.contains(style)) {
                document.head.removeChild(style);
            }
        }
    }, [isCopied, settings.bgColor]);

    const redrawCanvas = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        drawings.forEach(drawing => {
            ctx.beginPath();
            ctx.strokeStyle = drawing.color;
            ctx.lineWidth = drawing.size;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            
            drawing.points.forEach((point, index) => {
                if (index === 0) {
                    ctx.moveTo(point.x, point.y);
                } else {
                    ctx.lineTo(point.x, point.y);
                }
            });
            ctx.stroke();
        });
    }, [drawings]);

    useEffect(() => {
        const canvas = canvasRef.current;
        const container = chartAreaRef.current; // Use the chart area for observing
        if (!canvas || !container) return;

        const resizeObserver = new ResizeObserver(entries => {
            for (let entry of entries) {
                const { width, height } = entry.contentRect;
                canvas.width = width;
                canvas.height = height;
                redrawCanvas();
            }
        });

        resizeObserver.observe(container);

        return () => resizeObserver.disconnect();
    }, [redrawCanvas]);
    
    useEffect(() => {
        redrawCanvas();
    }, [drawings, redrawCanvas]);

    const handleDrawStart = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        if ('touches' in e) e.preventDefault();
        
        isDrawingRef.current = true;
        const coords = getEventCoordinates(e);
        if (!coords) return;
        const { x, y } = coords;

        currentPathRef.current = {
            tool: activeTool,
            points: [{ x, y }],
            color: brushColor,
            size: BRUSH_SIZE,
        };

        if (activeTool === 'trendline') {
            canvasSnapshotRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height);
        }
    };
    
    const handleDrawMove = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
        if (!isDrawingRef.current || !currentPathRef.current) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        if ('touches' in e) e.preventDefault();
        
        const coords = getEventCoordinates(e);
        if (!coords) return;
        const { x, y } = coords;

        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        if (activeTool === 'brush') {
            const currentPath = currentPathRef.current;
            currentPath.points.push({ x, y });

            const p1 = currentPath.points[currentPath.points.length - 2];
            const p2 = currentPath.points[currentPath.points.length - 1];

            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = currentPath.color;
            ctx.lineWidth = currentPath.size;
            ctx.stroke();
        } else if (activeTool === 'trendline') {
            if (canvasSnapshotRef.current) {
                ctx.putImageData(canvasSnapshotRef.current, 0, 0);
            } else {
                 ctx.clearRect(0, 0, canvas.width, canvas.height);
                 redrawCanvas();
            }

            const startPoint = currentPathRef.current.points[0];
            ctx.beginPath();
            ctx.moveTo(startPoint.x, startPoint.y);
            ctx.lineTo(x, y);
            ctx.strokeStyle = currentPathRef.current.color;
            ctx.lineWidth = currentPathRef.current.size;
            ctx.stroke();
        }
    };

    const handleDrawEnd = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
        if (!isDrawingRef.current || !currentPathRef.current) return;
        
        if ('touches' in e) e.preventDefault();
        isDrawingRef.current = false;
        const coords = getEventCoordinates(e);

        if (activeTool === 'trendline' && coords) {
             currentPathRef.current.points.push({ x: coords.x, y: coords.y });
        }
        
        setDrawings(prev => [...prev, currentPathRef.current!]);
        
        currentPathRef.current = null;
        canvasSnapshotRef.current = null;
    };

    const timeFormatter = (time: number) => {
        const date = new Date(time);
        const hours = date.getUTCHours().toString().padStart(2, '0');
        const minutes = date.getUTCMinutes().toString().padStart(2, '0');
        
        if (['1d', '3d', '1w'].includes(timeframe)) {
            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
        }
        return `${hours}:${minutes}`;
    };

    const CustomTooltip: React.FC<any> = ({ active, payload }) => {
        if (active && payload && payload.length) {
            const point = payload[0].payload;
            return (
                <div className="p-2 bg-light-card/80 dark:bg-dark-card/80 backdrop-blur-lg rounded-lg shadow-xl border border-light-border/50 dark:border-dark-border/50 text-sm">
                    <p className="font-bold text-dark-text dark:text-light-text">{new Date(point.time).toUTCString()}</p>
                    <p>Open: <span style={{ color: settings.textColor }}>{point?.open?.toFixed(4) ?? 'N/A'}</span></p>
                    <p>High: <span className="text-green-500">{point?.high?.toFixed(4) ?? 'N/A'}</span></p>
                    <p>Low: <span className="text-red-500">{point?.low?.toFixed(4) ?? 'N/A'}</span></p>
                    <p>Close: <span style={{ color: settings.textColor }}>{point?.close?.toFixed(4) ?? 'N/A'}</span></p>
                </div>
            );
        }
        return null;
    };
    
    // Custom label for HTF levels
    const LevelLabel = (props: any) => {
        const { viewBox, value, labelText } = props;
        if (!viewBox) return null;
        const { x, y, width } = viewBox;
        const priceStr = value.toFixed(value > 100 ? 1 : 4);
        
        const labelX = 10;
        const labelY = y;

        const boxWidth = priceStr.length * 7 + 8;
        const boxX = x + width + 1;
        const boxY = y - 9;

        return (
            <g>
                <text x={labelX} y={labelY} dy={4} fill="#facc15" fontSize={12} fontWeight="bold">
                    {labelText}
                </text>
                <rect x={boxX} y={boxY} width={boxWidth} height={18} fill="#4a5568" rx="2" />
                <text x={boxX + 4} y={labelY} dy={4} fill="#e5e9f2" fontSize={11} fontWeight="bold">
                    {priceStr}
                </text>
            </g>
        );
    };

    return (
        <div className="fixed inset-0 bg-dark-bg/80 dark:bg-dark-bg/90 backdrop-blur-sm flex justify-center items-center z-40 p-4">
            <div ref={modalRef} className="relative w-full max-w-4xl h-[60vh] md:h-[70vh] lg:h-[85vh] max-h-[800px] bg-light-card dark:bg-dark-card rounded-2xl shadow-2xl flex flex-col border border-light-border/50 dark:border-dark-border/50">
                <div className="flex justify-between items-center p-4 border-b border-light-border dark:border-dark-border">
                    <div>
                        <h2 className="text-2xl font-bold text-dark-text dark:text-light-text">{symbol} <span className="text-base font-normal text-medium-text-light dark:text-medium-text">({timeframe})</span></h2>
                        <div className="flex items-center gap-4 text-xs text-medium-text-light dark:text-medium-text">
                            <span>Price: <span className="font-semibold text-dark-text dark:text-light-text">${data?.price?.toFixed(4) ?? 'N/A'}</span></span>
                        </div>
                    </div>
                     <div className="flex items-center gap-2">
                        {['4h', '8h'].includes(timeframe) && (
                            <button
                                onClick={() => setShowHtfLevels(prev => !prev)}
                                className={`text-xl w-10 h-10 flex items-center justify-center rounded-lg transition-colors relative ${showHtfLevels ? 'bg-light-border dark:bg-dark-border text-primary-light dark:text-primary' : 'text-medium-text-light dark:text-medium-text hover:bg-light-border dark:hover:bg-dark-border'}`}
                                aria-label="Toggle HTF Levels"
                                title="Toggle Previous Week/Month Levels"
                                disabled={isLoadingHtfLevels}
                            >
                                {isLoadingHtfLevels ? (
                                    <i className="fa-solid fa-spinner fa-spin"></i>
                                ) : (
                                    <i className="fa-solid fa-layer-group"></i>
                                )}
                            </button>
                        )}
                        <button 
                            onClick={() => setShowGoldenPocket(prev => !prev)}
                            className={`text-xl w-10 h-10 flex items-center justify-center rounded-lg transition-colors ${showGoldenPocket ? 'bg-light-border dark:bg-dark-border text-primary-light dark:text-primary' : 'text-medium-text-light dark:text-medium-text hover:bg-light-border dark:hover:bg-dark-border'}`}
                            aria-label="Toggle Golden Pocket"
                            title="Toggle Golden Pocket (0.618 - 0.65 Fib)"
                        >
                            <i className="fa-solid fa-wave-square"></i>
                        </button>
                        <button 
                            onClick={() => setShowVolumeProfile(prev => !prev)}
                            className={`text-xl w-10 h-10 flex items-center justify-center rounded-lg transition-colors ${showVolumeProfile ? 'bg-light-border dark:bg-dark-border text-primary-light dark:text-primary' : 'text-medium-text-light dark:text-medium-text hover:bg-light-border dark:hover:bg-dark-border'}`}
                            aria-label="Toggle volume profile"
                            title="Toggle Volume Profile"
                        >
                            <i className="fa-solid fa-chart-bar"></i>
                        </button>
                         <button 
                            onClick={onSwitchToStochChart} 
                            className="text-xl w-10 h-10 flex items-center justify-center rounded-lg text-medium-text-light dark:text-medium-text hover:bg-light-border dark:hover:bg-dark-border transition-colors" 
                            aria-label="View Stochastic RSI chart"
                            title="View Stochastic RSI Chart"
                        >
                            <i className="fa-solid fa-chart-simple"></i>
                        </button>
                        <button 
                            onClick={onSwitchToRsiChart} 
                            className="text-xl w-10 h-10 flex items-center justify-center rounded-lg text-medium-text-light dark:text-medium-text hover:bg-light-border dark:hover:bg-dark-border transition-colors"
                            aria-label="View RSI chart"
                            title="View RSI Chart"
                        >
                            <i className="fa-solid fa-chart-line"></i>
                        </button>
                        <button onClick={onClose} className="text-2xl w-10 h-10 flex items-center justify-center rounded-lg text-medium-text-light dark:text-medium-text hover:text-dark-text dark:hover:text-light-text transition-colors" aria-label="Close chart">
                            <i className="fa-solid fa-xmark"></i>
                        </button>
                    </div>
                </div>
                
                <div className="px-4 py-2 border-b border-light-border dark:border-dark-border bg-light-bg/50 dark:bg-dark-bg/50">
                    <DrawingToolbar 
                        activeTool={activeTool}
                        onToolChange={setActiveTool}
                        brushColor={brushColor}
                        onColorChange={setBrushColor}
                        onClear={() => setDrawings([])}
                        textColor={settings.textColor}
                        onCopy={handleCapture}
                        isCopied={isCopied}
                    />
                </div>
                
                 <div ref={chartContainerRef} className="relative flex-grow p-4 dark:bg-black rounded-b-2xl flex items-stretch">
                    <div ref={chartAreaRef} className="relative flex-grow h-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartData} syncId="priceSync" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                                <XAxis dataKey="time" hide={true} />
                                <YAxis orientation="right" domain={['auto', 'auto']} stroke={settings.textColor} fontSize={12} axisLine={false} tickLine={false} />
                                <Tooltip content={<CustomTooltip />} />
                                
                                {showGoldenPocket && goldenPocketLevels && (
                                    <ReferenceArea
                                        y1={goldenPocketLevels.top}
                                        y2={goldenPocketLevels.bottom}
                                        stroke="#facc15"
                                        strokeOpacity={0.5}
                                        fill="#facc15"
                                        fillOpacity={0.2}
                                    >
                                        <Label value="GP" offset={10} position="insideRight" style={{ fill: '#facc15', fontSize: 10, opacity: 0.9 }} />
                                    </ReferenceArea>
                                )}

                                <Line type="monotone" dataKey="close" stroke={settings.rsiColor} strokeWidth={settings.lineWidth} dot={false} name="Price" isAnimationActive={false} />
                                
                                {showVolumeProfile && volumeProfileData && (
                                    <>
                                        <ReferenceLine y={volumeProfileData.poc} stroke="#facc15" strokeDasharray="3 3" strokeOpacity={0.9}>
                                            <Label value="POC" offset={10} position="insideRight" style={{ fill: '#facc15', fontSize: 10 }} />
                                        </ReferenceLine>
                                        <ReferenceLine y={volumeProfileData.vah} stroke={settings.textColor} strokeDasharray="2 4" strokeOpacity={0.6}>
                                            <Label value="VAH" offset={10} position="insideRight" style={{ fill: settings.textColor, fontSize: 10, opacity: 0.7 }} />
                                        </ReferenceLine>
                                        <ReferenceLine y={volumeProfileData.val} stroke={settings.textColor} strokeDasharray="2 4" strokeOpacity={0.6}>
                                            <Label value="VAL" offset={10} position="insideRight" style={{ fill: settings.textColor, fontSize: 10, opacity: 0.7 }} />
                                        </ReferenceLine>
                                    </>
                                )}
                                
                                {showHtfLevels && htfLevels && (
                                    <>
                                        {htfLevels.weekly.vah && <ReferenceLine y={htfLevels.weekly.vah} stroke="#facc15" strokeOpacity={0.7} label={<LevelLabel value={htfLevels.weekly.vah} labelText="W/Vah" />} />}
                                        {htfLevels.weekly.poc && <ReferenceLine y={htfLevels.weekly.poc} stroke="#facc15" strokeOpacity={0.7} label={<LevelLabel value={htfLevels.weekly.poc} labelText="w/Poc" />} />}
                                        {htfLevels.weekly.val && <ReferenceLine y={htfLevels.weekly.val} stroke="#facc15" strokeOpacity={0.7} label={<LevelLabel value={htfLevels.weekly.val} labelText="W/Val" />} />}
                                        {htfLevels.monthly.vah && <ReferenceLine y={htfLevels.monthly.vah} stroke="#facc15" strokeOpacity={0.7} label={<LevelLabel value={htfLevels.monthly.vah} labelText="Monthly VAH" />} />}
                                        {htfLevels.monthly.poc && <ReferenceLine y={htfLevels.monthly.poc} stroke="#facc15" strokeOpacity={0.7} label={<LevelLabel value={htfLevels.monthly.poc} labelText="Monthly/poc" />} />}
                                    </>
                                )}
                            </LineChart>
                        </ResponsiveContainer>
                        <canvas
                            ref={canvasRef}
                            className="absolute top-0 left-0 w-full h-full pointer-events-auto"
                            onMouseDown={handleDrawStart}
                            onMouseMove={handleDrawMove}
                            onMouseUp={handleDrawEnd}
                            onMouseLeave={handleDrawEnd}
                            onTouchStart={handleDrawStart}
                            onTouchMove={handleDrawMove}
                            onTouchEnd={handleDrawEnd}
                            onTouchCancel={handleDrawEnd}
                            style={{ zIndex: 10, cursor: 'crosshair' }}
                        />
                    </div>
                     {showVolumeProfile && volumeProfileData && (
                        <VolumeProfileDisplay data={volumeProfileData} />
                    )}
                </div>
            </div>
        </div>
    );
};

interface VolumeProfileDisplayProps {
    data: VolumeProfileData;
}

const VolumeProfileDisplay: React.FC<VolumeProfileDisplayProps> = ({ data }) => {
    const { profile, maxVolume } = data;
    
    const sellColor = '#be185d'; // pink-700
    const buyColor = '#0891b2'; // cyan-600
    const bgColor = '#374151'; // gray-700

    return (
        <div className="relative w-24 h-full flex flex-col-reverse ml-2" aria-label="Volume Profile">
            {profile.map((bucket, index) => {
                const totalWidthPercent = (bucket.volume / maxVolume) * 100;
                const sellWidthPercent = bucket.volume > 0 ? (bucket.sellVolume / bucket.volume) * 100 : 0;
                const buyWidthPercent = bucket.volume > 0 ? (bucket.buyVolume / bucket.volume) * 100 : 0;

                return (
                    <div 
                        key={index} 
                        className="flex-1 flex items-center justify-end" 
                        title={`Price: ${bucket.price.toFixed(4)}, Vol: ${bucket.volume.toFixed(2)} (Buy: ${bucket.buyVolume.toFixed(2)}, Sell: ${bucket.sellVolume.toFixed(2)})`}
                    >
                        <div
                            className="relative h-full flex"
                            style={{ width: `${totalWidthPercent}%`, backgroundColor: bgColor }}
                        >
                            {/* Sell volume bar */}
                            <div
                                className="h-full"
                                style={{ width: `${sellWidthPercent}%`, backgroundColor: sellColor }}
                            />
                            {/* Buy volume bar */}
                            <div
                                className="h-full"
                                style={{ width: `${buyWidthPercent}%`, backgroundColor: buyColor }}
                            />
                        </div>
                    </div>
                );
            })}
        </div>
    );
};


export default PriceDetailModal;