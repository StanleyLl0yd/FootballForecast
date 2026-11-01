// PostgreSQL timestamptz must be explicit and unambiguous. Date.parse alone
// also accepts date-only, local-time and loosely formatted strings, which can
// silently corrupt pre-kickoff time-cutoff comparisons across timezones.
export function explicitTimestamp(value:unknown):value is string {
  if(typeof value!=='string')return false;
  const m=/^(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,6})?(?:Z|[+-](?:0\d|1[0-3]):[0-5]\d|[+-]14:00)$/.exec(value);
  if(!m||!Number.isFinite(Date.parse(value)))return false;
  const day=new Date(0);
  day.setUTCFullYear(Number(m[1]),Number(m[2])-1,Number(m[3]));
  return day.getUTCFullYear()===Number(m[1])&&
    day.getUTCMonth()===Number(m[2])-1&&day.getUTCDate()===Number(m[3]);
}
