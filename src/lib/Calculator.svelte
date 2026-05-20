<script lang="ts">
  import { onMount, onDestroy } from 'svelte'

  const today = new Date()
  function toInputDateString(d: Date) {
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }
  let lmpStr: string = toInputDateString(today) // YYYY-MM-DD
  let eddStr: string = ''
  let lastEdited: 'lmp' | 'edd' = 'lmp'

  function parseDate(s: string) {
    return s ? new Date(s + 'T00:00:00') : null
  }

  function addDays(d: Date, days: number) {
    const r = new Date(d)
    r.setDate(r.getDate() + days)
    return r
  }

  function startOfDay(d: Date) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate())
  }

  function dayDiff(start: Date, end: Date) {
    return Math.floor((startOfDay(end).getTime() - startOfDay(start).getTime()) / (1000 * 60 * 60 * 24))
  }

  $: lmpDate = parseDate(lmpStr)
  $: eddDate = parseDate(eddStr)

  // Note: avoid assigning back to lmpStr/eddStr inside reactive blocks to prevent
  // cyclical dependencies. Input handlers compute the counterpart date directly.


  // Use an active LMP date for gestation calculations (derived from EDD if needed)
  $: activeLmp = lmpDate || (eddDate ? addDays(eddDate, -280) : null)
  $: gestDays = activeLmp ? dayDiff(activeLmp, new Date()) : 0
  $: gestWeeks = Math.max(0, Math.floor(gestDays / 7))
  $: gestRemainingDays = Math.max(0, gestDays % 7)

  const milestones = [14, 20, 30, 33, 38]

  let targetWeeks: number = 0
  let targetDays: number = 0
  let targetDate: Date | null = null
  let targetDateLabel = 'Set an EDD first.'

  function getDateForGestation(weeks: number, days: number) {
    if (!eddDate || weeks < 0 || days < 0 || days > 6) return null
    return addDays(eddDate, weeks * 7 + days - 280)
  }

  $: targetDate = getDateForGestation(targetWeeks, targetDays)
  $: targetDateLabel = !eddDate
    ? 'Set an EDD first.'
    : targetWeeks < 0 || targetDays < 0 || targetDays > 6
    ? 'Enter a valid week and 0–6 days.'
    : targetDate
    ? fmt(targetDate)
    : 'Enter a week and day.'

  let reverseDateStr: string = toInputDateString(today)
  $: reverseDate = parseDate(reverseDateStr)
  $: reverseGestationLabel = getGestationForDate(reverseDate)

  function getGestationForDate(date: Date | null) {
    if (!eddDate) return 'Set an EDD first.'
    if (!date) return 'Enter a valid date.'

    const pregnancyStart = addDays(eddDate, -280)
    const days = dayDiff(pregnancyStart, date)
    if (Number.isNaN(days)) return 'Enter a valid date.'
    if (days < 0) return 'Date is before gestation start.'

    const weeks = Math.floor(days / 7)
    const daysRem = days % 7
    return `${weeks} week${weeks !== 1 ? 's' : ''} ${daysRem} day${daysRem !== 1 ? 's' : ''}`
  }

  let ageDateStr: string = toInputDateString(today)
  $: ageDate = parseDate(ageDateStr)
  $: ageLabel = getAgeFromDate(ageDate)

  function daysInMonth(year: number, month: number) {
    return new Date(year, month + 1, 0).getDate()
  }

  function getAgeFromDate(date: Date | null) {
    if (!date) return 'Enter a valid date.'
    const now = startOfDay(new Date())
    const birth = startOfDay(date)
    if (birth > now) return 'Date is in the future.'

    let years = now.getFullYear() - birth.getFullYear()
    let months = now.getMonth() - birth.getMonth()
    let days = now.getDate() - birth.getDate()

    if (days < 0) {
      months -= 1
      const prevMonth = (now.getMonth() + 11) % 12
      const prevMonthYear = prevMonth === 11 ? now.getFullYear() - 1 : now.getFullYear()
      days += daysInMonth(prevMonthYear, prevMonth)
    }

    if (months < 0) {
      years -= 1
      months += 12
    }

    return `${years} year${years !== 1 ? 's' : ''} ${months} month${months !== 1 ? 's' : ''} ${days} day${days !== 1 ? 's' : ''}`
  }

  // BMI
  let weight = 50
  let height = 150
  $: bmi = height > 0 ? +(weight / ((height / 100) ** 2)).toFixed(1) : 0
  $: bmiCategory = getBmiCategory(bmi)
  $: normalWeightMin = height > 0 ? +(18.5 * ((height / 100) ** 2)).toFixed(1) : null
  $: normalWeightMax = height > 0 ? +(24.9 * ((height / 100) ** 2)).toFixed(1) : null
  $: overweightWeightMin = height > 0 ? +(25 * ((height / 100) ** 2)).toFixed(1) : null
  $: overweightWeightMax = height > 0 ? +(29.9 * ((height / 100) ** 2)).toFixed(1) : null
  $: obeseWeightMin = height > 0 ? +(30 * ((height / 100) ** 2)).toFixed(1) : null

  function getBmiCategory(b: number) {
    if (!b) return '—'
    if (b < 18.5) return 'Underweight'
    if (b < 25) return 'Normal'
    if (b < 30) return 'Overweight'
    return 'Obese'
  }

  function fmt(d: Date | null) {
    if (!d) return '—'
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
  }

  type ClinicResult = {
    eddDate: Date | null
    gestWeeks: number
    gestRemainingDays: number
    confirmedAt: Date
  }

  let clinicStart = ''
  let confirmTimer: ReturnType<typeof setTimeout> | null = null
  let clinicResults: ClinicResult[] = []

  function deleteClinicResult(index: number) {
    clinicResults = clinicResults.filter((_, i) => i !== index)
  }

  function scheduleClinicUpdate(lmpValue: string, eddValue: string) {
    const lmpDateInput = parseDate(lmpValue)
    const eddDateInput = parseDate(eddValue)
    const activeLmpInput = lmpDateInput || (eddDateInput ? addDays(eddDateInput, -280) : null)
    const days = activeLmpInput ? dayDiff(activeLmpInput, new Date()) : 0
    const weeks = Math.max(0, Math.floor(days / 7))
    const remainingDays = Math.max(0, days % 7)

    if (confirmTimer) {
      clearTimeout(confirmTimer)
    }
    confirmTimer = setTimeout(() => {
      clinicResults = [
        ...clinicResults,
        {
          eddDate: eddDateInput,
          gestWeeks: weeks,
          gestRemainingDays: remainingDays,
          confirmedAt: new Date()
        }
      ]
    }, 10000)
  }

  onDestroy(() => {
    if (confirmTimer) {
      clearTimeout(confirmTimer)
    }
  })

  onMount(() => {
    clinicStart = new Date().toLocaleString()
    // initialize EDD from LMP
    if (!eddStr && lmpDate) {
      eddStr = toInputDateString(addDays(lmpDate, 280))
    }
  })
</script>

<style>
  .card { padding: 1rem; border-radius: 8px; background:#fff; box-shadow:0 2px 8px rgba(0,0,0,.06); max-width:720px; margin:0 auto }
  .row { display:flex; gap:1rem; flex-wrap:wrap }
  .field { flex:1 1 200px }
  label { display:block; font-size:.85rem; color:#333; margin-bottom:.25rem }
  input[type="date"], input[type="number"] { width:100%; padding:.5rem; border:1px solid #ddd; border-radius:4px }
  h2 { margin:.5rem 0 }
  .milestone { padding:.25rem 0 }
  .bmi { font-weight:600 }
  .bmi-table { width:100%; border-collapse:collapse; margin-top:.5rem }
  .bmi-table th, .bmi-table td { border:1px solid #ddd; padding:.6rem .75rem; text-align:left }
  .bmi-table th { background:#f7f7f7; font-weight:700 }
  .bmi-table tr:nth-child(even) { background:#fbfbfb }
</style>

<div class="card">
  <h2>Obstetric Calculator. Today: {new Date().toLocaleDateString()} </h2>

<div style="margin-top:1rem; padding:1rem; border:1px solid #eee; border-radius:8px; background:#f9f9f9">
  <div class="row">
    <div class="field">
      <label for="lmp">Last Menstrual Period (LMP)</label>
      <input id="lmp" type="date" bind:value={lmpStr} on:input={(e:any) => { lastEdited = 'lmp'; const v = e.target.value; lmpStr = v; const d = parseDate(v); if (d) eddStr = toInputDateString(addDays(d, 280)); scheduleClinicUpdate(lmpStr, eddStr); }} />
    </div>
    <div class="field">
      <label for="edd">Estimated Due Date (EDD)</label>
      <input id="edd" type="date" bind:value={eddStr} on:input={(e:any) => { lastEdited = 'edd'; const v = e.target.value; eddStr = v; const d = parseDate(v); if (d) lmpStr = toInputDateString(addDays(d, -280)); scheduleClinicUpdate(lmpStr, eddStr); }} />
    </div>
    <div class="field">
      <label for="gestation">Gestation</label>
      <div id="gestation">{gestWeeks} week{gestWeeks !== 1 ? 's' : ''} {gestRemainingDays} day{gestRemainingDays !== 1 ? 's' : ''}
      </div>
    </div>
  </div>

    <div class="row" style="margin-top: 1rem;">
      <div class="field">
        <label for="targetWeeks">Weeks</label>
        <input id="targetWeeks" type="number" min="0" bind:value={targetWeeks} />
      </div>
      <div class="field">
        <label for="targetDays">Days</label>
        <input id="targetDays" type="number" min="0" max="6" bind:value={targetDays} />
      </div>
      <div class="field">
        <div style="font-size:.85rem; color:#333; margin-bottom:.25rem">Occurs on</div>
        <div>{targetDateLabel}</div>
      </div>
    </div>

    <div class="row" style="margin-top:1rem;">
      <div class="field">
        <label for="reverseDate">Date</label>
        <input id="reverseDate" type="date" bind:value={reverseDateStr} />
      </div>
      <div class="field">
        <div style="font-size:.85rem; color:#333; margin-bottom:.25rem">Gestational age</div>
        <div>{reverseGestationLabel}</div>
      </div>
    </div>

    <div style="margin-top:.5rem">
    {#if activeLmp}
      {#each milestones as m}
        <div class="milestone">{m}+0 weeks: {fmt(addDays(activeLmp, m*7))}</div>
      {/each}
    {/if}
    </div>

  </div>


  <div style="margin-top:1rem; padding:1rem; border:1px solid #eee; border-radius:8px; background:#f9f9f9">
    <h3 style="margin-top:1rem">BMI</h3>
      <div class="row">
        <div class="field">
        <label for="weight">Weight (kg)</label>
        <input id="weight" type="number" bind:value={weight} min="1" />
      </div>
    <div class="field">
      <label for="height">Height (cm)</label>
      <input id="height" type="number" bind:value={height} min="1" />
    </div>
    <div class="field">
      <label for="bmi">Current BMI</label>
      <div id="bmi" class="bmi">{bmi} — {bmiCategory}</div>
    </div>
  </div>
    <table class="bmi-table">
      <thead>
        <tr>
          <th>Category</th>
          <th>Weight for {height} cm</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Normal</td>
          <td>{normalWeightMin && normalWeightMax ? `${normalWeightMin}–${normalWeightMax} kg` : '—'}</td>
        </tr>
        <tr>
          <td>Overweight</td>
          <td>{overweightWeightMin && overweightWeightMax ? `${overweightWeightMin}–${overweightWeightMax} kg` : '—'}</td>
        </tr>
        <tr>
          <td>Obese</td>
          <td>{obeseWeightMin ? `${obeseWeightMin}+ kg` : '—'}</td>
       </tr>
      </tbody>
    </table>
  </div>

  <div style="margin-top:1rem; padding:1rem; border:1px solid #eee; border-radius:8px; background:#f9f9f9">
    <h3 style="margin:.25rem 0 .75rem; font-size:1rem">Calculate age</h3>
    <div class="row">
      <div class="field">
        <label for="ageDate">Date</label>
        <input id="ageDate" type="date" bind:value={ageDateStr} />
      </div>
      <div class="field">
        <div style="font-size:.85rem; color:#333; margin-bottom:.25rem">Age</div>
        <div>{ageLabel}</div>
      </div>
    </div>
  </div>

  <div style="margin-top:1.5rem; padding:1rem; border:1px solid #e0e0e0; border-radius:8px; background:#fafafa">
    <h2 style="margin:0 0 .75rem">History since {clinicStart}</h2>
    {#if clinicResults.length > 0}
      <ol style="margin:0; padding-left:1.25rem;">
        {#each clinicResults as result, index}
          <li style="margin:.35rem 0; display:flex; justify-content:space-between; align-items:center; gap:.75rem">
            <span><strong>{index + 1}.</strong> EDD {fmt(result.eddDate)} · Gestation {result.gestWeeks} week{result.gestWeeks !== 1 ? 's' : ''} {result.gestRemainingDays} day{result.gestRemainingDays !== 1 ? 's' : ''}</span>
            <button type="button" on:click={() => deleteClinicResult(index)} style="font-size:.85rem; padding:.25rem .5rem; border:none; background:#ef5350; color:#fff; border-radius:4px; cursor:pointer">Delete</button>
          </li>
        {/each}
      </ol>
    {:else}
      <div>No clinic results confirmed yet.</div>
    {/if}
  </div>
</div>
