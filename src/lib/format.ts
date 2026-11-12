// All times are shown in Philippine time, whatever the viewer's device setting.
const manilaDateTime = new Intl.DateTimeFormat('en-PH', {
  timeZone: 'Asia/Manila',
  dateStyle: 'medium',
  timeStyle: 'short',
})

export function formatManilaDateTime(isoTimestamp: string): string {
  return manilaDateTime.format(new Date(isoTimestamp))
}
