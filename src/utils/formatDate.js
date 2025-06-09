export const formatDate = (timestamp) => {
  if (!timestamp) return '';
  const date = typeof timestamp.toDate === 'function' ? timestamp.toDate() : new Date(timestamp);
  const days = ['Sun', 'Mon', 'Tues', 'Wed', 'Thurs', 'Fri', 'Sat'];
  const dayOfWeek = days[date.getDay()];
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${dayOfWeek} ${dd}-${mm}-${yyyy}, ${hh}:${min}`;
};

export const formatDeliveryDay = (input) => {
  if (!input) return '';
  if (input==='asap') return 'asap';
  const date = typeof input.toDate === 'function' ? input.toDate() : new Date(input);
  if (isNaN(date.getTime())) return '';
  const days = ['Sun', 'Mon', 'Tues', 'Wed', 'Thurs', 'Fri', 'Sat'];
  const dayOfWeek = days[date.getDay()];
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  return `${dayOfWeek} ${dd}-${mm}-${yyyy}`;
};
