
import type { SymbolData, Timeframe, RsiDataPoint, PriceDataPoint, HTFLevels } from '../types';
import { calculateVolumeProfile } from './volumeProfileService';

const API_BASE_URL = 'https://api.binance.com/api/v3/klines';

const calculateRSI = (klines: any[][], length: number): RsiDataPoint[] => {
    const closes = klines.map((k: any[]) => parseFloat(k[4]));
    if (closes.length <= length) return [];

    const gains: number[] = [];
    const losses: number[] = [];
    for (let i = 1; i < closes.length; i++) {
        const change = closes[i] - closes[i - 1];
        gains.push(Math.max(0, change));
        losses.push(Math.max(0, -change));
    }

    let avgGain = gains.slice(0, length).reduce((sum, val) => sum + val, 0) / length;
    let avgLoss = losses.slice(0, length).reduce((sum, val) => sum + val, 0) / length;

    const rsiValues: number[] = [];
    for (let i = length; i < gains.length; i++) {
        const rs = avgLoss === 0 ? Infinity : avgGain / avgLoss;
        const rsi = 100 - (100 / (1 + rs));
        rsiValues.push(rsi);

        avgGain = (avgGain * (length - 1) + gains[i]) / length;
        avgLoss = (avgLoss * (length - 1) + losses[i]) / length;
    }
    
    // The first RSI value corresponds to the candle at index `length + 1`.
    const relevantKlines = klines.slice(length + 1);

    return rsiValues.map((value, index) => ({
        time: relevantKlines[index][0], // Use the open time of the corresponding kline
        value: value,
    }));
};

const calculateSMA = (data: RsiDataPoint[], length: number): RsiDataPoint[] => {
    if (data.length < length) return [];

    const smaValues: RsiDataPoint[] = [];
    // Start from the point where a full `length` window is available
    for (let i = length - 1; i < data.length; i++) {
        const window = data.slice(i - length + 1, i + 1);
        const sum = window.reduce((acc, point) => acc + point.value, 0);
        smaValues.push({
            time: data[i].time,
            value: sum / length,
        });
    }
    return smaValues;
};


export const fetchRsiForSymbol = async (symbol: string, timeframe: Timeframe, limit: number = 80): Promise<SymbolData> => {
    try {
        const rsiPeriod = 14;
        const smaPeriod = 14;
        const url = `${API_BASE_URL}?symbol=${symbol}&interval=${timeframe}&limit=${limit + rsiPeriod + 1}`;
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch data for ${symbol}`);
        }
        const klines = await response.json();

        if (!klines || klines.length === 0) {
            return { rsi: [], sma: [], price: 0, volume: 0, klines: [] };
        }

        const rsiData = calculateRSI(klines, rsiPeriod);
        const smaData = calculateSMA(rsiData, smaPeriod);
        const latestKline = klines[klines.length - 1];

        const processedKlines: PriceDataPoint[] = klines.map((k: any[]) => ({
            time: k[0],
            open: parseFloat(k[1]),
            high: parseFloat(k[2]),
            low: parseFloat(k[3]),
            close: parseFloat(k[4]),
            volume: parseFloat(k[5]),
            takerBuyVolume: parseFloat(k[9]),
        })).slice(-limit);

        return {
            rsi: rsiData.slice(-limit),
            sma: smaData.slice(-limit),
            price: parseFloat(latestKline[4]),
            volume: parseFloat(latestKline[5]),
            klines: processedKlines,
        };
    } catch (error) {
        // console.error(`Error fetching data for ${symbol}:`, error);
        return { rsi: [], sma: [], price: 0, volume: 0, klines: [] }; // Return empty data on error
    }
};

const getPreviousPeriodTimestamps = (period: 'week' | 'month') => {
    const now = Date.now();
    let startTime: number, endTime: number;

    if (period === 'week') {
        const today = new Date(now);
        today.setUTCHours(0, 0, 0, 0);
        // Sunday is 0, we want to align to Monday=1..Sunday=7(0)
        const dayOfWeek = today.getUTCDay() === 0 ? 7 : today.getUTCDay();

        // End of last week (last Sunday)
        const endOfLastWeek = new Date(today);
        endOfLastWeek.setUTCDate(today.getUTCDate() - dayOfWeek);
        endTime = endOfLastWeek.getTime() + (24 * 60 * 60 * 1000) - 1; // Sunday 23:59:59.999

        // Start of last week (Monday)
        const startOfLastWeek = new Date(endOfLastWeek);
        startOfLastWeek.setUTCDate(endOfLastWeek.getUTCDate() - 6);
        startTime = startOfLastWeek.getTime();

    } else { // month
        const today = new Date(now);
        // End of last month
        const endOfLastMonth = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 0));
        endOfLastMonth.setUTCHours(23, 59, 59, 999);
        endTime = endOfLastMonth.getTime();

        // Start of last month
        const startOfLastMonth = new Date(Date.UTC(endOfLastMonth.getUTCFullYear(), endOfLastMonth.getUTCMonth(), 1));
        startTime = startOfLastMonth.getTime();
    }
    return { startTime, endTime };
};

export const fetchHigherTimeframeLevels = async (symbol: string): Promise<HTFLevels> => {
    const weeklyTimestamps = getPreviousPeriodTimestamps('week');
    const monthlyTimestamps = getPreviousPeriodTimestamps('month');

    const timeframeForProfile = '1h';
    const weeklyUrl = `${API_BASE_URL}?symbol=${symbol}&interval=${timeframeForProfile}&startTime=${weeklyTimestamps.startTime}&endTime=${weeklyTimestamps.endTime}&limit=1000`;
    const monthlyUrl = `${API_BASE_URL}?symbol=${symbol}&interval=${timeframeForProfile}&startTime=${monthlyTimestamps.startTime}&endTime=${monthlyTimestamps.endTime}&limit=1000`;

    try {
        const [weeklyResponse, monthlyResponse] = await Promise.all([
            fetch(weeklyUrl),
            fetch(monthlyUrl)
        ]);

        if (!weeklyResponse.ok || !monthlyResponse.ok) {
            console.error("Failed to fetch HTF klines");
            return { weekly: { poc: null, vah: null, val: null }, monthly: { poc: null, vah: null, val: null } };
        }

        const weeklyKlinesRaw = await weeklyResponse.json();
        const monthlyKlinesRaw = await monthlyResponse.json();

        const processKlines = (klines: any[][]): PriceDataPoint[] => {
            if (!klines || klines.length === 0) return [];
            return klines.map((k: any[]) => ({
                time: k[0],
                open: parseFloat(k[1]),
                high: parseFloat(k[2]),
                low: parseFloat(k[3]),
                close: parseFloat(k[4]),
                volume: parseFloat(k[5]),
                takerBuyVolume: parseFloat(k[9]),
            }));
        };

        const weeklyKlines = processKlines(weeklyKlinesRaw);
        const monthlyKlines = processKlines(monthlyKlinesRaw);

        const weeklyProfile = calculateVolumeProfile(weeklyKlines, 70);
        const monthlyProfile = calculateVolumeProfile(monthlyKlines, 70);

        return {
            weekly: {
                poc: weeklyProfile?.poc ?? null,
                vah: weeklyProfile?.vah ?? null,
                val: weeklyProfile?.val ?? null,
            },
            monthly: {
                poc: monthlyProfile?.poc ?? null,
                vah: monthlyProfile?.vah ?? null,
                val: monthlyProfile?.val ?? null,
            }
        };

    } catch (error) {
        console.error(`Error fetching HTF levels for ${symbol}:`, error);
        return { weekly: { poc: null, vah: null, val: null }, monthly: { poc: null, vah: null, val: null } };
    }
};