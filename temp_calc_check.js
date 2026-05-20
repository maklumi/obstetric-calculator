function parseDate(s){return s?new Date(s+"T00:00:00"):null}
function addDays(d,days){const r=new Date(d);r.setDate(r.getDate()+days);return r}
function startOfDay(d){return new Date(d.getFullYear(),d.getMonth(),d.getDate())}
function dayDiff(start,end){return Math.floor((startOfDay(end).getTime()-startOfDay(start).getTime())/(1000*60*60*24))}
let lmp=parseDate("2026-05-01"); let edd=addDays(lmp,280); console.log("LMP",lmp.toISOString(),"EDD",edd.toISOString()); let today=parseDate("2026-05-19"); console.log("gestDays",dayDiff(lmp,today),"gest",Math.floor(dayDiff(lmp,today)/7),dayDiff(lmp,today)%7); let date=parseDate("2026-05-19"); let pregnancyStart=addDays(edd,-280); console.log("reverse",dayDiff(pregnancyStart,date),Math.floor(dayDiff(pregnancyStart,date)/7),dayDiff(pregnancyStart,date)%7);
