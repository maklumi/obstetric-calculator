<script lang="ts">
  import { onMount, onDestroy } from "svelte";

  const today = new Date();
  function toInputDateString(d: Date) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  let lmpStr: string = toInputDateString(today); // YYYY-MM-DD
  let eddStr: string = "";
  let lastEdited: "lmp" | "edd" = "lmp";

  function parseDate(s: string) {
    return s ? new Date(s + "T00:00:00") : null;
  }

  function addDays(d: Date, days: number) {
    const r = new Date(d);
    r.setDate(r.getDate() + days);
    return r;
  }

  function startOfDay(d: Date) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  function dayDiff(start: Date, end: Date) {
    return Math.floor(
      (startOfDay(end).getTime() - startOfDay(start).getTime()) /
        (1000 * 60 * 60 * 24),
    );
  }

  $: lmpDate = parseDate(lmpStr);
  $: eddDate = parseDate(eddStr);

  // Note: avoid assigning back to lmpStr/eddStr inside reactive blocks to prevent
  // cyclical dependencies. Input handlers compute the counterpart date directly.

  // Use an active LMP date for gestation calculations (derived from EDD if needed)
  $: activeLmp = lmpDate || (eddDate ? addDays(eddDate, -280) : null);
  $: gestDays = activeLmp ? dayDiff(activeLmp, new Date()) : 0;
  $: gestWeeks = Math.max(0, Math.floor(gestDays / 7));
  $: gestRemainingDays = Math.max(0, gestDays % 7);

  const milestones = [14, 20, 30, 33, 38];

  let targetWeeks: number = 0;
  let targetDays: number = 0;
  let targetDate: Date | null = null;
  let targetDateLabel = "Set an EDD first.";

  function getDateForGestation(weeks: number, days: number) {
    if (!eddDate || weeks < 0 || days < 0 || days > 6) return null;
    return addDays(eddDate, weeks * 7 + days - 280);
  }

  $: targetDate = getDateForGestation(targetWeeks, targetDays);
  $: targetDateLabel = !eddDate
    ? "Set an EDD first."
    : targetWeeks < 0 || targetDays < 0 || targetDays > 6
      ? "Enter a valid week and 0–6 days."
      : targetDate
        ? fmt(targetDate)
        : "Enter a week and day.";

  let reverseDateStr: string = toInputDateString(today);
  $: reverseDate = parseDate(reverseDateStr);
  $: reverseGestationLabel = getGestationForDate(reverseDate);

  function getGestationForDate(date: Date | null) {
    if (!eddDate) return "Set an EDD first.";
    if (!date) return "Enter a valid date.";

    const pregnancyStart = addDays(eddDate, -280);
    const days = dayDiff(pregnancyStart, date);
    if (Number.isNaN(days)) return "Enter a valid date.";
    if (days < 0) return "Date is before gestation start.";

    const weeks = Math.floor(days / 7);
    const daysRem = days % 7;
    return `${weeks} week${weeks !== 1 ? "s" : ""} ${daysRem} day${daysRem !== 1 ? "s" : ""}`;
  }

  let ageDateStr: string = toInputDateString(today);
  $: ageDate = parseDate(ageDateStr);
  $: ageLabel = getAgeFromDate(ageDate);

  function daysInMonth(year: number, month: number) {
    return new Date(year, month + 1, 0).getDate();
  }

  function getAgeFromDate(date: Date | null) {
    if (!date) return "Enter a valid date.";
    const now = startOfDay(new Date());
    const birth = startOfDay(date);
    if (birth > now) return "Date is in the future.";

    let years = now.getFullYear() - birth.getFullYear();
    let months = now.getMonth() - birth.getMonth();
    let days = now.getDate() - birth.getDate();

    if (days < 0) {
      months -= 1;
      const prevMonth = (now.getMonth() + 11) % 12;
      const prevMonthYear =
        prevMonth === 11 ? now.getFullYear() - 1 : now.getFullYear();
      days += daysInMonth(prevMonthYear, prevMonth);
    }

    if (months < 0) {
      years -= 1;
      months += 12;
    }

    return `${years} year${years !== 1 ? "s" : ""} ${months} month${months !== 1 ? "s" : ""} ${days} day${days !== 1 ? "s" : ""}`;
  }

  // BMI
  let weight = 50;
  let height = 150;
  $: bmi = height > 0 ? +(weight / (height / 100) ** 2).toFixed(1) : 0;
  $: bmiCategory = getBmiCategory(bmi);
  $: normalWeightMin =
    height > 0 ? +(18.5 * (height / 100) ** 2).toFixed(1) : null;
  $: normalWeightMax =
    height > 0 ? +(24.9 * (height / 100) ** 2).toFixed(1) : null;
  $: overweightWeightMin =
    height > 0 ? +(25 * (height / 100) ** 2).toFixed(1) : null;
  $: overweightWeightMax =
    height > 0 ? +(29.9 * (height / 100) ** 2).toFixed(1) : null;
  $: obeseWeightMin =
    height > 0 ? +(30 * (height / 100) ** 2).toFixed(1) : null;

  function getBmiCategory(b: number) {
    if (!b) return "—";
    if (b < 18.5) return "Underweight";
    if (b < 25) return "Normal";
    if (b < 30) return "Overweight";
    return "Obese";
  }

  function fmt(d: Date | null) {
    if (!d) return "—";
    return d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  type ClinicResult = {
    eddDate: Date | null;
    gestWeeks: number;
    gestRemainingDays: number;
    confirmedAt: Date;
  };

  let clinicStart = "";
  let confirmTimer: ReturnType<typeof setTimeout> | null = null;
  let clinicResults: ClinicResult[] = [];

  function deleteClinicResult(index: number) {
    clinicResults = clinicResults.filter((_, i) => i !== index);
  }

  function scheduleClinicUpdate(lmpValue: string, eddValue: string) {
    const lmpDateInput = parseDate(lmpValue);
    const eddDateInput = parseDate(eddValue);
    const activeLmpInput =
      lmpDateInput || (eddDateInput ? addDays(eddDateInput, -280) : null);
    const days = activeLmpInput ? dayDiff(activeLmpInput, new Date()) : 0;
    const weeks = Math.max(0, Math.floor(days / 7));
    const remainingDays = Math.max(0, days % 7);

    if (confirmTimer) {
      clearTimeout(confirmTimer);
    }
    confirmTimer = setTimeout(() => {
      clinicResults = [
        ...clinicResults,
        {
          eddDate: eddDateInput,
          gestWeeks: weeks,
          gestRemainingDays: remainingDays,
          confirmedAt: new Date(),
        },
      ];
    }, 10000);
  }

  onDestroy(() => {
    if (confirmTimer) {
      clearTimeout(confirmTimer);
    }
  });

  onMount(() => {
    clinicStart = new Date().toLocaleString();
    // initialize EDD from LMP
    if (!eddStr && lmpDate) {
      eddStr = toInputDateString(addDays(lmpDate, 280));
    }
  });
</script>


<div id="app">

<div class="card">
  <h3>Calculate Gestational Age. Today {new Date().toLocaleDateString()}</h3>
  <div class="row">
    <div class="field">
      <label for="lmp">Last Menstrual Period (LMP)</label>
      <input
        id="lmp"
        type="date"
        bind:value={lmpStr}
        on:input={(e: any) => {
          lastEdited = "lmp";
          const v = e.target.value;
          lmpStr = v;
          const d = parseDate(v);
          if (d) eddStr = toInputDateString(addDays(d, 280));
          scheduleClinicUpdate(lmpStr, eddStr);
        }}
      />
    </div>
    <div class="field">
      <label for="edd">Estimated Due Date (EDD)</label>
      <input
        id="edd"
        type="date"
        bind:value={eddStr}
        on:input={(e: any) => {
          lastEdited = "edd";
          const v = e.target.value;
          eddStr = v;
          const d = parseDate(v);
          if (d) lmpStr = toInputDateString(addDays(d, -280));
          scheduleClinicUpdate(lmpStr, eddStr);
        }}
      />
    </div>
    <div class="field">
      <label for="gestation">Gestation</label>
      <div id="gestation" class="bmi">
        {gestWeeks} week{gestWeeks !== 1 ? "s" : ""}
        {gestRemainingDays} day{gestRemainingDays !== 1 ? "s" : ""}
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
      <input
        id="targetDays"
        type="number"
        min="0"
        max="6"
        bind:value={targetDays}
      />
    </div>
    <div class="field">
      <label for="occursOn">Occurs on</label>
      <div id="occursOn" class="bmi">{targetDateLabel}</div>
    </div>
  </div>

  <div class="row" style="margin-top:1rem;">
    <div class="field">
      <label for="reverseDate">Date</label>
      <input id="reverseDate" type="date" bind:value={reverseDateStr} />
    </div>
    <div class="field">
      <label for="reverseGestation">Gestational age</label>
      <div id="reverseGestation" class="bmi">{reverseGestationLabel}</div>
    </div>
  </div>

  <div style="margin-top:.5rem">
    {#if activeLmp}
      {#each milestones as m}
        <div class="milestone">
          {m} weeks: {fmt(addDays(activeLmp, m * 7))}
        </div>
      {/each}
    {/if}
  </div>
</div>

<div class="card">
  <h3>Calculate BMI</h3>
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
        <td
          >{normalWeightMin && normalWeightMax
            ? `${normalWeightMin}–${normalWeightMax} kg`
            : "—"}</td
        >
      </tr>
      <tr>
        <td>Overweight</td>
        <td
          >{overweightWeightMin && overweightWeightMax
            ? `${overweightWeightMin}–${overweightWeightMax} kg`
            : "—"}</td
        >
      </tr>
      <tr>
        <td>Obese</td>
        <td>{obeseWeightMin ? `${obeseWeightMin}+ kg` : "—"}</td>
      </tr>
    </tbody>
  </table>
</div>

<div class="card">
  <h3>Calculate Age</h3>
  <div class="row">
    <div class="field">
      <label for="ageDate">Date</label>
      <input id="ageDate" type="date" bind:value={ageDateStr} />
    </div>
    <div class="field">
      <label for="age">Age</label>
      <div id="age" class="bmi">{ageLabel}</div>
    </div>
  </div>
</div>

<div class="card">
  <h3>History since {clinicStart}</h3>
  {#if clinicResults.length > 0}
    <ol style="margin:0; padding-left:1.25rem;">
      {#each clinicResults as result, index}
        <li
          style="margin:.35rem 0; display:flex; justify-content:space-between; align-items:center; gap:.75rem"
        >
          <span
            ><strong>{index + 1}.</strong> EDD {fmt(result.eddDate)} · Gestation
            {result.gestWeeks} week{result.gestWeeks !== 1 ? "s" : ""}
            {result.gestRemainingDays} day{result.gestRemainingDays !== 1
              ? "s"
              : ""}</span
          >
          <button
            type="button"
            on:click={() => deleteClinicResult(index)}
            style="font-size:.85rem; padding:.25rem .5rem; border:none; background:#ef5350; color:#000; border-radius:4px; cursor:pointer"
            >Delete</button
          >
        </li>
      {/each}
    </ol>
  {:else}
    <div>No clinic results confirmed yet.</div>
  {/if}
</div>

</div>

<style>
  #app {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    width: 100%;
    height: 100%;
    gap: 0;
  }

  .card {
    padding: 24px;
    background: var(--md-surface);
    box-shadow: var(--md-elevation-2);
    border-radius: 4px;
    margin: 0;
    border-left: 4px solid var(--md-primary);
  }

  .card h3 {
    color: var(--md-primary);
    margin: 0 0 24px 0;
    font-size: 20px;
    font-weight: 500;
    padding-bottom: 12px;
    border-bottom: 2px solid var(--md-divider);
  }

  .row {
    display: flex;
    gap: 16px;
    flex-wrap: wrap;
    margin-bottom: 24px;
    padding: 0;
  }

  .row:last-child {
    margin-bottom: 0;
  }

  .field {
    flex: 1 1 1;
    min-width: auto;
    margin: 8px 24px 0 0;
    display: flex;
    flex-direction: column;
  }

  label {
    display: block;
    font-size: var(--md-label-small);
    font-weight: 500;
    color: var(--md-text-secondary);
    margin-bottom: 4px;
    text-transform: uppercase;
    letter-spacing: 0.4px;
  }

  input[type="date"],
  input[type="number"] {
    width: 80%;
    padding: 4px;
    border: 1px solid var(--md-border);
    border-radius: 4px;
    font-family: var(--sans);
    font-size: var(--md-body-medium);
    color: var(--md-text-primary);
    background: var(--md-surface);
    transition: all 0.2s ease;
  }

  input[type="date"]:hover,
  input[type="number"]:hover {
    border-color: var(--md-primary);
    box-shadow: var(--md-elevation-1);
  }

  input[type="date"]:focus,
  input[type="number"]:focus {
    outline: none;
    border-color: var(--md-primary);
    box-shadow: 0 0 0 3px var(--md-primary-light), var(--md-elevation-2);
  }

  input[type="date"]::placeholder,
  input[type="number"]::placeholder {
    color: var(--md-text-disabled);
  }

  .milestone {
    padding: 4px;
    font-size: var(--md-body-medium);
    color: var(--md-text-primary);
    border-bottom: 1px solid var(--md-divider);
    margin: 0;
  }

  .milestone:first-child {
    padding-top: 0;
  }

  .milestone:last-child {
    border-bottom: none;
    padding-bottom: 0;
  }

  .bmi {
    font-weight: 600;
    color: var(--md-primary);
    font-size: 16px;
  }

  .bmi-table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 16px;
    border: 1px solid var(--md-border);
  }

  .bmi-table th,
  .bmi-table td {
    border: 1px solid var(--md-divider);
    padding: 12px 16px;
    text-align: left;
  }

  .bmi-table th {
    background: var(--md-primary-light);
    color: var(--md-on-primary);
    font-weight: 600;
    font-size: var(--md-label-small);
    text-transform: uppercase;
    letter-spacing: 0.4px;
  }

  .bmi-table td {
    font-size: var(--md-body-small);
    color: var(--md-text-primary);
  }

  .bmi-table tr:nth-child(odd) {
    background: var(--md-background);
  }

  .bmi-table tr:hover {
    background: var(--md-primary-light);
    color: var(--md-on-primary);
  }

  /* List styles */
  ol {
    margin: 0;
    padding-left: 24px;
  }

  li {
    margin: 8px 0;
    padding: 8px;
    border-radius: 4px;
    background: var(--md-background);
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    font-size: var(--md-label-large);
    transition: all 0.2s ease;
  }

  li:hover {
    background: var(--md-primary-light);
    color: var(--md-on-primary);
  }

  button {
    padding: 8px 16px;
    border: none;
    background: var(--md-error);
    color: white;
    border-radius: 4px;
    cursor: pointer;
    font-size: var(--md-label-small);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    transition: all 0.2s ease;
    box-shadow: var(--md-elevation-1);
  }

  button:hover {
    box-shadow: var(--md-elevation-4);
    transform: translateY(-2px);
  }

  button:active {
    transform: translateY(0);
    box-shadow: var(--md-elevation-2);
  }
</style>
