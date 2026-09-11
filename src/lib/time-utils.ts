export const isValidHHMM = (s: string): boolean => /^([01]\d|2[0-3]):([0-5]\d)$/.test(s);

export const formatTimeInput = (value: string): string => {
    const digits = value.replace(/[^0-9]/g, '');
    if (digits.length <= 2) return digits;
    const hh = digits.slice(0, 2);
    const mm = digits.slice(2, 4);
    return mm ? `${hh}:${mm}` : hh;
};

export const timeToMinutes = (timeStr: string): number => {
    if (!timeStr || !isValidHHMM(timeStr)) return 0;
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
};

export const minutesToTime = (mins: number): string => {
    // Handle wrapping around 24 hours
    const normalizedMins = ((mins % 1440) + 1440) % 1440;
    const h = Math.floor(normalizedMins / 60);
    const m = Math.floor(normalizedMins % 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

export const getTimeDiff = (planned: string, real: string): number => {
    if (!real || !planned || !isValidHHMM(real) || !isValidHHMM(planned)) return 0;
    return timeToMinutes(real) - timeToMinutes(planned);
};

export const getCurrentTimeString = (date: Date): string => {
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
};
