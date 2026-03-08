export function toIso(input) {
  return new Date(input).toISOString();
}

export function addMinutes(dateLike, minutes) {
  const date = new Date(dateLike);
  date.setMinutes(date.getMinutes() + Number(minutes || 0));
  return date;
}

export function isValidRange(startAt, endAt) {
  return new Date(startAt).getTime() < new Date(endAt).getTime();
}
