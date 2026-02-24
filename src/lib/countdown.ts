export type TimeLeft = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
};

export function getTimeLeft(targetTimestamp: number, nowTimestamp: number = Date.now()): TimeLeft {
  const difference = targetTimestamp - nowTimestamp;

  if (difference <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0 };
  }

  return {
    days: Math.floor(difference / (1000 * 60 * 60 * 24)),
    hours: Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
    minutes: Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60)),
    seconds: Math.floor((difference % (1000 * 60)) / 1000)
  };
}
